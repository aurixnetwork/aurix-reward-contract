# BNB Smart Chain Mainnet Contract Readiness

## Status and scope

This phase prepares the contract repository for a future BNB Smart Chain Mainnet deployment. It does not deploy a contract, create a campaign, assign a post-deployment role, fund a contract, approve or transfer tokens, or mutate the reward-server repository.

Current result: **NOT READY / `overallReady: false`**. The Mainnet AURX token passed live read-only validation, but all production role addresses and the deployer address remain `REQUIRED_OWNER_INPUT`. The one-shot deployment guard is intentionally false. There is no Mainnet `AurixRewardClaim` address.

## Frozen validated baseline

The readiness branch starts from Testnet-validated commit `ad1fec6e3b6119eb021db9fed4c47ddc08ca3213`. `AurixRewardClaim.sol`, `IAurixRewardClaim.sol`, and the exported ABI are frozen. `npm run validate:baseline` fails if their exact SHA-256 identities or compiler settings change:

| Item | Frozen identity |
| --- | --- |
| `contracts/AurixRewardClaim.sol` | `b50386b729a315274ac7b19d4e9f0a1fb6a3e53636696f9236ddabbac054f99d` |
| `contracts/interfaces/IAurixRewardClaim.sol` | `eddb8dd83ffa5f57840bc6702db6291b1d94789f42f827b4841ce3d723a80b30` |
| `abi/AurixRewardClaim.json` | `36eb89b5d3194d3ca82ca46430bec53310067d3fb60223315dbc9ae29abe1c21` |
| Compiler | Solidity `0.8.28+commit.7893614a`, optimizer 200, Paris, `viaIR: false` |

No Solidity business logic change was required or made. `claimReward`, `RewardAuthorization`, events, role identifiers, campaign functions, mapping getters, and constructor order remain ABI-compatible with the validated Testnet baseline.

The existing contract stores `rewardNonces[campaignId][claimant]`, so one wallet has independent nonce sequences in different campaigns. `usedRewardIds[rewardId]` remains global across every campaign in the deployment. Server policies such as `FIRST_REWARD_ONLY`, `ONCE_PER_CAMPAIGN`, recurring dispatch, queues, run persistence, wallet transaction-nonce coordination, and the DappBay pilot remain off-chain responsibilities.

## Repository review findings

The complete tracked contract repository was reviewed before implementation:

- `hardhat.config.ts` previously exposed only chain-97 Testnet networks and a shared Testnet deployer key. Mainnet now has independent chain-56 signerless network entries and `BSC_MAINNET_RPC_URL`.
- `scripts/lib/config.ts`, IRB preflight, deployment, validation, explorer, Sourcify, and BscScan preparation scripts intentionally contain fixed Testnet values. They remain Testnet-only rather than being generalized by search-and-replace.
- `deployments/bsc-testnet-*`, `reports/bsc-testnet-*`, and `verification/bscscan-testnet/` remain authoritative Testnet evidence and were not rewritten. Mainnet gets its own filename namespace and schema example.
- Existing initial role constants are validated Testnet addresses only. Mainnet uses separate empty environment slots and rejects silent Testnet-address inheritance.
- Existing test campaign IDs are deterministic local fixtures, not production campaign configuration. No Mainnet campaign ID is introduced.
- Generic campaign/inspection scripts do not participate in deployment. Mainnet Hardhat networks contain no automatic signer, and the Mainnet deployment lifecycle explicitly stops before campaign creation.
- ABI export, compiler configuration, package scripts, CI, documentation, Sourcify configuration, and secret-handling conventions were reviewed. The Mainnet work adds strict frozen-baseline and Secretlint gates without changing Solidity.

## Explicit network profiles

| Profile | Chain ID | Reward token | Reward contract | RPC variable |
| --- | ---: | --- | --- | --- |
| `TESTNET` | `97` | IRISBANK / IRB at `0x7daf7fE962B123A6698D5e3a109c551872790AeA` | `0x355D58c905f42F4f78abCD7413371F6EE4Dba137` | `BSC_TESTNET_RPC_URL` |
| `MAINNET` | `56` | AURX at `0x24ECb00840081D56116fC6D076988411a5595fd0` | not deployed | `BSC_MAINNET_RPC_URL` |

The two profiles have separate Hardhat network entries and environment variables. Mainnet networks configure no automatic signer accounts; the guarded deployment script constructs only the explicitly reviewed Mainnet deployer. Profile, configured chain ID, and RPC-reported chain ID must all match. IRB, the Testnet reward address, Testnet role addresses, and Testnet deployment artifacts are rejected by Mainnet readiness unless Testnet role-address reuse has separately and explicitly been approved by the owner.

Use `.env.testnet.example` or `.env.mainnet.example` as the source for an ignored `.env`; do not combine profiles or commit populated credentials.

## Live AURX read-only validation

On 2026-08-18, `npm run mainnet:readiness` observed through BSC Mainnet RPC:

| Field | Result |
| --- | --- |
| RPC chain ID | `56` |
| AURX address | `0x24ECb00840081D56116fC6D076988411a5595fd0` |
| Runtime bytecode | present, `3,639` bytes |
| `name()` | `AURIX Network` |
| `symbol()` | `AURX` |
| `decimals()` | `18` |
| Observed gas price | `0.05 gwei` (informational and time-sensitive) |
| Transactions sent | `0` |

These observations must be repeated immediately before deployment. Historical success does not bypass preflight.

## Mainnet readiness and preflight

Read-only command:

```bash
npm run mainnet:readiness
```

It checks all of the following and exits nonzero unless every deployment prerequisite is satisfied:

1. `AURIX_NETWORK_PROFILE=MAINNET`.
2. Hardhat network chain ID is `56`.
3. RPC reports chain ID `56`.
4. `AURX_TOKEN_ADDRESS` is exactly the reviewed AURX address.
5. AURX bytecode exists.
6. AURX `name()`, `symbol()`, and `decimals()` are readable; symbol is `AURX` and decimals are `18`.
7. Every required role address is present, valid, nonzero, and not silently inherited from Testnet.
8. The Approver is separate from admin, Approver manager, campaign manager, pauser, and treasury recovery.
9. The deployer address is present and valid; its BNB balance is displayed read-only.
10. Current gas price is readable.
11. `MAINNET_REWARD_CONTRACT_ADDRESS` is empty before the initial deployment and never equals the Testnet address.
12. The compiler, source, interface, and ABI match the frozen baseline.
13. The one-shot `MAINNET_DEPLOYMENT_ENABLED=true` guard is present.
14. The seven constructor values are displayed in exact order.

The report always contains `mode: READ_ONLY` and `transactionsSent: 0`. It never includes RPC URLs, private keys, or API credentials.

## Required owner inputs

No production address is inferred. The owner must explicitly approve and supply:

| Environment slot | Constructor/security purpose |
| --- | --- |
| `MAINNET_DEPLOYER_ADDRESS` | known EOA that sends only the deployment transaction |
| `MAINNET_DEFAULT_ADMIN_ADDRESS` | `DEFAULT_ADMIN_ROLE`; role administration and unpause |
| `MAINNET_APPROVER_MANAGER_ADDRESS` | manages `APPROVER_ROLE` membership |
| `MAINNET_APPROVER_ADDRESS` | isolated off-chain authorization signer |
| `MAINNET_CAMPAIGN_MANAGER_ADDRESS` | creates and narrowly updates campaigns |
| `MAINNET_PAUSER_ADDRESS` | pauses claims |
| `MAINNET_TREASURY_RECOVERY_ADDRESS` | paused-only token recovery |

The deployment operator also supplies `BSC_MAINNET_RPC_URL` and, only for the deployment invocation, `MAINNET_DEPLOYER_PRIVATE_KEY` through an untracked secure environment. Explorer verification additionally needs `ETHERSCAN_API_KEY`. None may be committed.

## EIP-712 Mainnet domain

The future deployment domain is:

```text
name: AurixRewardClaim
version: 1
chainId: 56
verifyingContract: <future deployed Mainnet AurixRewardClaim address>
```

Chain ID `97` and `0x355D58c905f42F4f78abCD7413371F6EE4Dba137` are Testnet-only. Deterministic tests sign the same authorization under both domains and prove the recovered signer is invalid when a signature is cross-used.

## Future deployment lifecycle

This is the exact next phase, after owner inputs, audit/risk acceptance, and a reviewed change window:

1. Checkout the reviewed readiness commit and run `npm ci`, compile, lint, Secretlint, tests, coverage, production audit, and frozen-baseline validation.
2. Populate an ignored `.env` from `.env.mainnet.example`; keep `MAINNET_DEPLOYMENT_ENABLED=false`.
3. Run readiness read-only. Resolve every issue other than the intentionally false guard.
4. Run one final read-only readiness invocation with the guard enabled only in that process and review chain, AURX, deployer balance, gas, roles, and constructor values.
5. With explicit owner authorization, run the one guarded deployment command shown below once.
6. The script deploys `AurixRewardClaim` with AURX, waits confirmations, checks `rewardToken`, roles, Approver separation, and the EIP-712 domain, then writes `deployments/bsc-mainnet-<contract-address>.json` with network, chain, address, transaction, block, compiler, commit, timestamp, and constructor evidence.
7. Reset/unset the deployment guard immediately.
8. Run `npm run validate:mainnet:deployment` with `MAINNET_DEPLOYMENT_ARTIFACT` set. It performs read-only receipt, runtime bytecode, AURX, role, and EIP-712 checks.
9. Run `npm run verify:mainnet` to publish source after artifact review. This is an explorer API action, not a blockchain transaction.
10. Review and commit the address-specific public evidence and a stable Mainnet pointer in a separate deployment-evidence phase.
11. **Stop before campaign creation or funding.** Campaign setup is a separately approved operational phase.

Proposed deployment command—documented only; **DO NOT EXECUTE during readiness**:

```bash
AURIX_NETWORK_PROFILE=MAINNET MAINNET_DEPLOYMENT_ENABLED=true npm run deploy:mainnet
```

## Stop conditions and rollback semantics

Abort before sending if any profile/chain/token/metadata/role/deployer/compiler/ABI/guard check fails, if the constructor display is not exactly approved, or if the deployer balance is insufficient for the estimate plus margin. Abort subsequent operations if the receipt, runtime bytecode, immutable AURX address, roles, Approver separation, or EIP-712 domain fails post-deployment validation.

The contract is non-upgradeable. A successful deployment transaction cannot be rolled back. If post-deployment validation fails, do not fund it, do not create a campaign, do not publish it as current, and require an owner decision on remediation or a replacement deployment. Never represent the existing AURX token audit as an audit of this contract.

## Artifact isolation

Testnet evidence remains under `deployments/bsc-testnet-*`. Mainnet uses `deployments/bsc-mainnet-<address>.json`; its schema example is `deployments/bsc-mainnet.example.json`. Address-specific outputs are ignored until manually reviewed, so a future run cannot overwrite the committed Testnet baseline or silently publish unreviewed deployment data.
