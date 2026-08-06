# Aurix Reward Contract — Codex Project Instructions

## Project purpose

Build and maintain the public smart-contract repository for the Aurix Network reward system.

This repository is independent from the Node.js reward server repository.

## Fixed test environment

- Network: BNB Smart Chain Testnet
- Chain ID: 97
- Test token name: IRISBANK
- Test token symbol: IRB
- Test token contract:
  0x7daf7fE962B123A6698D5e3a109c551872790AeA

Do not create or deploy MockAURX, AURX Test Token, or any replacement test token.

Before deployment, verify through RPC:

1. The connected chain ID is 97.
2. The configured IRB address contains contract bytecode.
3. name(), symbol(), and decimals() can be read.
4. Record the returned metadata in the deployment report.
5. Abort deployment if the network or token validation fails.

## Contract architecture

Contract name:

AurixRewardClaim

Primary model:

Approver EIP-712 authorization plus User Wallet self-claim.

The final claim transaction must be signed and sent by the claimant wallet.

## Reward authorization

The signed authorization must bind at least:

- claimant
- amount
- campaignId
- rewardId
- rewardNonce
- validAfter
- deadline

The EIP-712 domain must bind:

- contract name
- contract version
- chain ID
- verifying contract address

## Replay protection

Implement both:

- globally unique rewardId usage tracking
- per-wallet rewardNonce tracking

The same authorization or signature must never successfully pay twice.

## Campaign model

Each campaign must independently support:

- campaignId
- total budget
- distributed amount
- maximum reward amount
- start time
- end time
- claim interval
- active status

The claim interval must be configurable per campaign.

The initial allowed interval range is:

- minimum: 1 hour
- maximum: 7 days

Track the last successful claim by campaign and claimant.

Eligibility rule:

block.timestamp >= lastClaimAt[campaignId][claimant] + campaign.claimInterval

The campaign manager must be able to update the interval within the allowed range.

## Security requirements

Use audited OpenZeppelin primitives where appropriate:

- AccessControl
- EIP712
- ECDSA
- SafeERC20
- Pausable
- ReentrancyGuard

Enforce:

- msg.sender equals authorization.claimant
- valid Approver signature
- unused rewardId
- correct rewardNonce
- valid authorization time
- active campaign
- campaign time window
- nonzero amount
- amount not above campaign maximum
- campaign budget not exceeded
- sufficient token balance
- claim interval elapsed

Update replay-protection and accounting state before token transfer.

The entire transaction must revert if the token transfer fails.

## Roles

Use separated roles:

- DEFAULT_ADMIN_ROLE
- APPROVER_MANAGER_ROLE
- CAMPAIGN_MANAGER_ROLE
- PAUSER_ROLE
- TREASURY_ROLE

The off-chain Approver signer must not automatically receive admin, campaign-management, treasury, or unpause authority.

## Development rules

- Non-upgradeable v1 contract.
- Constructor receives the reward token address.
- Do not hardcode private keys.
- Do not commit secrets.
- Use custom Solidity errors.
- Emit comprehensive admin, campaign, signer, and reward events.
- Write NatSpec for public and external functions.
- Prefer explicit, readable security logic over clever gas optimizations.
- Keep ABI compatibility documented.
- Produce deterministic tests.
- Generate coverage and deployment reports.
- Do not deploy to mainnet.
- Do not claim the existing AURX token audit covers this contract.

## Testing requirements

Write positive and negative tests for:

- successful claim
- identical signature replay
- identical rewardId replay
- old rewardNonce
- future rewardNonce
- amount manipulation
- claimant manipulation
- campaignId manipulation
- deadline manipulation
- unauthorized signer
- stolen authorization used by another wallet
- authorization before validAfter
- expired authorization
- inactive campaign
- campaign not started
- campaign ended
- interval not elapsed
- maximum amount exceeded
- budget exceeded
- paused contract
- insufficient reward-token balance
- signer rotation
- pause and unpause roles
- campaign interval update
- one-hour interval
- seven-day interval

## Git and documentation

Maintain:

- README.md
- SECURITY.md
- CHANGELOG.md
- deployment reports
- test reports
- ABI output
- verified contract addresses

Use small, reviewable commits.

Never rewrite or force-push public main history without explicit owner approval.
