# BSC Testnet Post-Deployment Validation Report

## Execution result

Passed. Phase 2-5 read-only validation completed at `2026-08-13T18:42:50.239Z` against BNB Smart Chain Testnet block `124889323`. The connected chain ID was `97`.

No campaign was created, no IRB was transferred, no reward claim was executed, no role was changed, and the contract was not paused or unpaused. The validation command sent zero state-changing transactions. Explorer source verification was not performed.

## Deployment

| Field | Observed value |
| --- | --- |
| Contract | `AurixRewardClaim` |
| Contract address | `0x355D58c905f42F4f78abCD7413371F6EE4Dba137` |
| Deployment transaction | `0x8733558c29a8b7c705a4b26a393105111ce2ad3a665a4b6d2574e2817d5f400c` |
| Deployment block | `124887720` |
| Block timestamp | `2026-08-13T18:30:47.000Z` |
| Deployer | `0x2A37820df48d298De3907557b02301A46C2e127f` |
| Deployer balance at validation block | `0.0997261777 tBNB` (`99726177700000000` wei) |
| Gas used | `2738223` |
| Effective gas price | `0.1 gwei` (`100000000` wei) |
| Deployment fee | `0.0002738223 tBNB` (`273822300000000` wei) |

The RPC transaction and successful receipt matched the artifact transaction hash, contract address, deployer, and block. The seven constructor arguments decoded from the deployment transaction matched the fixed IRB and role addresses.

## Deployment artifact

`deployments/bsc-testnet-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json` passed structural and fixed-value validation. Its network, chain ID, timestamp, contract identity, transaction hash, block, deployer, constructor arguments, EIP-712 identity, and IRB preflight fields were valid.

The artifact contains no private key, RPC URL, API key, mnemonic, credential, or credential-like JSON key/value. Configured local credential values were also checked for accidental inclusion without printing them.

## Reward token verification

| Field | Observed value |
| --- | --- |
| `rewardToken()` | `0x7daf7fE962B123A6698D5e3a109c551872790AeA` |
| Token bytecode | Present, `5109` bytes |
| `name()` | `IRISBANK` |
| `symbol()` | `IRB` |
| `decimals()` | `18` |

## EIP-712 verification

| Domain field | Observed value |
| --- | --- |
| Fields bitmap | `0x0f` (name, version, chain ID, verifying contract) |
| Name | `AurixRewardClaim` |
| Version | `1` |
| Chain ID | `97` |
| Verifying contract | `0x355D58c905f42F4f78abCD7413371F6EE4Dba137` |
| Salt | Empty (`bytes32(0)`) |
| Extensions | None |

Both the explicit identity getters and ERC-5267 `eip712Domain()` returned the expected identity.

## Positive role checks

| Role | Required holder | `hasRole` |
| --- | --- | --- |
| `DEFAULT_ADMIN_ROLE` | `0x2A37820df48d298De3907557b02301A46C2e127f` | `true` |
| `APPROVER_MANAGER_ROLE` | `0x2A37820df48d298De3907557b02301A46C2e127f` | `true` |
| `APPROVER_ROLE` | `0x425f7117D36aC8F45224E895e583b404E0a6eb05` | `true` |
| `CAMPAIGN_MANAGER_ROLE` | `0x9B2fB8ED115242477C9a8Ea511a0D85E122E1FbE` | `true` |
| `PAUSER_ROLE` | `0x9B2fB8ED115242477C9a8Ea511a0D85E122E1FbE` | `true` |
| `TREASURY_ROLE` | `0x2A37820df48d298De3907557b02301A46C2e127f` | `true` |

Each on-chain role identifier also matched the expected `keccak256` role identifier; `DEFAULT_ADMIN_ROLE` matched `bytes32(0)`.

## Negative role checks

The Approver `0x425f7117D36aC8F45224E895e583b404E0a6eb05` returned `false` for `DEFAULT_ADMIN_ROLE`, `APPROVER_MANAGER_ROLE`, `CAMPAIGN_MANAGER_ROLE`, `PAUSER_ROLE`, and `TREASURY_ROLE`.

Operations `0x9B2fB8ED115242477C9a8Ea511a0D85E122E1FbE` returned `false` for `DEFAULT_ADMIN_ROLE`, `APPROVER_MANAGER_ROLE`, `APPROVER_ROLE`, and `TREASURY_ROLE`.

As an additional separation check, the admin/deployer returned `false` for `APPROVER_ROLE`, `CAMPAIGN_MANAGER_ROLE`, and `PAUSER_ROLE`.

## Current state and bytecode

- `paused()` returned `false`.
- Runtime bytecode exists at the deployed address and is `11304` bytes, equal to the expected local runtime size.
- Deployment initcode begins with the exact locally compiled creation bytecode, and its decoded constructor arguments match the artifact.
- Runtime bytecode matches the locally compiled `AurixRewardClaim` implementation after normalizing all `13` compiler-declared immutable reference slots.
- Exact unnormalized runtime equality is expectedly false because Solidity substitutes constructor-derived immutable values into those slots.
- The normalized on-chain and expected runtime hash is `0xd8decd4f4c3746f31fc8900213981b44916a5de43e07c73fe1de5bd58f2e43bf`.
- The raw on-chain runtime hash is `0xdb361ef4a136e2492492b8c54928bd2ff41eab83585428c2d66a3ed9b8ddae0c`.

## Tooling and tests

- `npm run validate:testnet:deployment`: passed; report recorded in `reports/bsc-testnet-post-deployment-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json`; zero transactions sent.
- `npm run compile`: passed; nothing needed recompilation.
- `npm run lint`: passed; Solhint and `tsc --noEmit` reported no errors.
- `npm test`: passed; `67` passing, `0` failing.

The machine-readable validation evidence contains the full positive and negative role results, bytecode hashes, receipt economics, token metadata, EIP-712 domain, and the explicit `transactionsSent: 0` result.

## Blockers

None for Phase 2-5 read-only validation. Explorer source verification remains deliberately pending and was outside this phase.
