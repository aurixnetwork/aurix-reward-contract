# Aurix Reward Contract

Public smart-contract repository for the Aurix Network reward authorization and claimant self-claim system. This repository is independent of the off-chain Node.js reward server.

## Status

Version 1 is implemented, covered by local automated tests, and deployed to BNB Smart Chain Testnet at `0x355D58c905f42F4f78abCD7413371F6EE4Dba137`. Read-only post-deployment validation passed. Explorer source verification has not yet been performed, and there is no BSC Mainnet deployment.

Passing tests and static checks do not make the contract audited or guarantee security. The existing Beosin review of the AURX token does not cover `AurixRewardClaim`; this contract requires its own independent security review before production use.

## Fixed BSC Testnet integration

- Network: BNB Smart Chain Testnet
- Chain ID: `97`
- Token standard: BEP-20
- Test token: IRISBANK / IRB
- Token address: `0x7daf7fE962B123A6698D5e3a109c551872790AeA`

This project does not create or deploy an AURX Test Token or any replacement testnet token. `TestERC20` exists only as an isolated local fixture. The deployment script supplies the exact IRB address to the constructor and first reads its bytecode, `name()`, `symbol()`, `decimals()`, and `totalSupply()` through the configured RPC. Token quantities are base units; no script assumes IRB decimals.

## Architecture

`AurixRewardClaim` is a non-upgradeable contract built with OpenZeppelin AccessControl, EIP712, ECDSA, SafeERC20, Pausable, and ReentrancyGuard.

The claim flow is:

1. The Aurix backend decides off-chain eligibility.
2. An EOA holding `APPROVER_ROLE` signs a `RewardAuthorization` using EIP-712.
3. The claimant submits `claimReward(authorization, signature)` from the authorized wallet.
4. The claimant pays the BNB/tBNB gas; `msg.sender` and the token recipient must equal `authorization.claimant`.
5. The contract checks the current signer role, campaign state, authorization timing, interval, nonce, global reward ID, budget, maximum, and token balance.
6. Replay/accounting state is updated before SafeERC20 transfers IRB to the claimant. A failed transfer reverts the complete transaction.

There is no separate user-request signature in v1. The claimant's on-chain transaction signature and the `msg.sender == claimant` check authorize the final action.

## EIP-712 authorization

```solidity
struct RewardAuthorization {
    address claimant;
    uint256 amount;
    bytes32 campaignId;
    bytes32 rewardId;
    uint256 rewardNonce;
    uint256 validAfter;
    uint256 deadline;
}
```

The domain is `name = AurixRewardClaim`, `version = 1`, the current chain ID, and the deployed verifying-contract address. Every struct field is signed. A signature therefore cannot be moved to another chain/deployment or altered without invalidation.

Replay protection has two independent layers: `usedRewardIds` is global to the deployment, while `rewardNonces[campaignId][claimant]` is sequential and independent per campaign-wallet pair.

## Campaigns and intervals

Each campaign owns a budget, distributed amount, per-claim maximum, start/end window, active flag, and interval from one hour through seven days. `lastClaimAt[campaignId][claimant]` is enforced on-chain.

The current campaign interval is used each time eligibility is evaluated. Changing seven days to one hour can make an existing claimant eligible immediately; changing one hour to seven days can extend that claimant's wait. The off-chain scheduler is not the source of truth.

## Roles

- `DEFAULT_ADMIN_ROLE`: critical role administration and unpause.
- `APPROVER_MANAGER_ROLE`: grants and revokes only `APPROVER_ROLE`.
- `APPROVER_ROLE`: signs authorizations; has no automatic admin, campaign, pause, or treasury authority.
- `CAMPAIGN_MANAGER_ROLE`: narrow campaign creation and update functions.
- `PAUSER_ROLE`: pauses claims.
- `TREASURY_ROLE`: paused-only reward-token withdrawal and unrelated-token recovery.

Initial addresses are explicit constructor arguments. The deployer receives no role unless its address is deliberately supplied for that role. Production role holders should be reviewed and migrated to appropriate multisig/governance arrangements.

Direct BNB and unknown calls revert. The contract has no native-currency deposit requirement or recovery path.

## Toolchain

- Node.js `22.23.1`
- Hardhat `2.29.0` with CommonJS TypeScript
- TypeScript `5.9.3`
- Solidity `0.8.28`, optimizer 200 runs, Paris EVM target, `viaIR` disabled
- ethers.js v6 (locked transitively by the toolbox/package lock)
- OpenZeppelin Contracts `5.4.0`
- Solidity Coverage `0.8.17`
- Solhint `6.2.3`

OpenZeppelin 5.4.0 is deliberately pinned to avoid newer Cancun-only bytecode instructions and retain a conservative Paris target for BSC compatibility.

## Local development

```bash
cp .env.example .env
npm ci
npm run compile
npm run lint
npm test
npm run coverage
npm run export:abi
```

Local tests do not require an RPC URL or private key. Generated build artifacts, coverage output, local environment files, and unreviewed deployment reports are ignored.

## BSC Testnet deployment

The public deployment metadata is in [`deployments/bsc-testnet-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json`](deployments/bsc-testnet-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json). To repeat the read-only post-deployment checks with the only address-specific artifact in `deployments/`:

```bash
npm run validate:testnet:deployment
```

If more than one address-specific artifact exists, set `DEPLOYMENT_ARTIFACT` to the intended JSON path. The validator checks the artifact, receipt and constructor data, runtime bytecode, IRB metadata, EIP-712 domain, role separation, and pause state. It sends zero transactions.

## BSC Testnet operations

Populate only the required placeholders in an untracked `.env`. Run the read-only preflight before any deployment decision:

```bash
npm run preflight:irb
npm run deploy:testnet:check
```

The readiness check validates the reviewed deployer and role mapping, reads the deployer balance and current gas price,
estimates deployment gas through `eth_estimateGas`, reports bytecode sizes, and sends zero transactions.

The deployment and verification commands are documented in [docs/BSC_TESTNET_DEPLOYMENT.md](docs/BSC_TESTNET_DEPLOYMENT.md). Explorer source verification remains pending. Never use these commands against BSC Mainnet.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [EIP-712 authorization](docs/EIP712_AUTHORIZATION.md)
- [Campaign model](docs/CAMPAIGN_MODEL.md)
- [Testing](docs/TESTING.md)
- [BSC Testnet deployment](docs/BSC_TESTNET_DEPLOYMENT.md)
- [BSC Testnet deployment readiness report](reports/DEPLOYMENT_READINESS_REPORT.md)
- [BSC Testnet post-deployment validation report](reports/POST_DEPLOYMENT_VALIDATION_REPORT.md)
- [ABI compatibility](docs/ABI_COMPATIBILITY.md)
- [Security reporting](SECURITY.md)

## License

MIT. See [LICENSE](LICENSE).
