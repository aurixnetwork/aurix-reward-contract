# Aurix Reward Contract — BSC Testnet Deployment Status

## Public status

- Project: Aurix Reward Contract
- Contract: `AurixRewardClaim`
- Development status: public BSC Testnet deployment baseline finalized
- Network: BNB Smart Chain Testnet
- Chain ID: `97`
- Contract address: [`0x355D58c905f42F4f78abCD7413371F6EE4Dba137`](https://testnet.bscscan.com/address/0x355D58c905f42F4f78abCD7413371F6EE4Dba137)
- Deployment transaction: [`0x8733558c29a8b7c705a4b26a393105111ce2ad3a665a4b6d2574e2817d5f400c`](https://testnet.bscscan.com/tx/0x8733558c29a8b7c705a4b26a393105111ce2ad3a665a4b6d2574e2817d5f400c)
- Deployment block: `124887720`
- Canonical deployment record: [`deployments/bsc-testnet-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json`](../deployments/bsc-testnet-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json)
- Stable consumer reference: [`deployments/bsc-testnet-current.json`](../deployments/bsc-testnet-current.json)
- Canonical ABI: [`abi/AurixRewardClaim.json`](../abi/AurixRewardClaim.json)
- Mainnet status: **NOT DEPLOYED**

This is public development software. Automated tests and source verification do not constitute an external security audit. The existing AURX token review does not cover `AurixRewardClaim`.

## Reward token

- Name: `IRISBANK`
- Symbol: `IRB`
- Decimals: `18`
- Address: [`0x7daf7fE962B123A6698D5e3a109c551872790AeA`](https://testnet.bscscan.com/address/0x7daf7fE962B123A6698D5e3a109c551872790AeA)

## Compiler identity

- Solidity: `0.8.28+commit.7893614a`
- Optimizer: enabled
- Optimizer runs: `200`
- EVM target: `paris`
- `viaIR`: `false`
- Normalized runtime bytecode hash: `0xd8decd4f4c3746f31fc8900213981b44916a5de43e07c73fe1de5bd58f2e43bf`
- Deployed source commit: `71bfbfa4252430bda6c907e5a7e78bedfa175116`
- Source-verification commit: `88f686b67e454eb4e2658d9a4cb4c03101dfe759`

The post-deployment validator confirmed matching initcode and constructor arguments, equal runtime size, and equal normalized runtime implementation bytecode.

## EIP-712 identity and campaign policy

- Domain name: `AurixRewardClaim`
- Domain version: `1`
- Domain chain ID: `97`
- Verifying contract: `0x355D58c905f42F4f78abCD7413371F6EE4Dba137`
- Minimum campaign claim interval: `1 hour` (`3600` seconds)
- Maximum campaign claim interval: `7 days` (`604800` seconds)

## Initial role assignments

| Role | Address |
| --- | --- |
| `DEFAULT_ADMIN_ROLE` | `0x2A37820df48d298De3907557b02301A46C2e127f` |
| `APPROVER_MANAGER_ROLE` | `0x2A37820df48d298De3907557b02301A46C2e127f` |
| `APPROVER_ROLE` | `0x425f7117D36aC8F45224E895e583b404E0a6eb05` |
| `CAMPAIGN_MANAGER_ROLE` | `0x9B2fB8ED115242477C9a8Ea511a0D85E122E1FbE` |
| `PAUSER_ROLE` | `0x9B2fB8ED115242477C9a8Ea511a0D85E122E1FbE` |
| `TREASURY_ROLE` | `0x2A37820df48d298De3907557b02301A46C2e127f` |

Read-only on-chain validation confirmed all positive assignments and the required negative separation checks. The contract was not paused when validated.

## Verification and validation evidence

- Source verification: passed
- Sourcify match: **exact match** for creation and runtime bytecode
- Sourcify match ID: `43607722`
- Sourcify verification timestamp: `2026-08-13T18:55:11Z`
- Public Sourcify reference: [`repo.sourcify.dev/97/0x355D...`](https://repo.sourcify.dev/97/0x355D58c905f42F4f78abCD7413371F6EE4Dba137)
- Source-verification report: [`reports/SOURCE_VERIFICATION_REPORT.md`](../reports/SOURCE_VERIFICATION_REPORT.md)
- Post-deployment validation: passed, zero transactions sent
- Post-deployment report: [`reports/POST_DEPLOYMENT_VALIDATION_REPORT.md`](../reports/POST_DEPLOYMENT_VALIDATION_REPORT.md)
- Local test status: `67 passing`, `0 failing`
- Compile status: passed
- Lint status: passed
- GitHub CI status: [passed for source-verification commit `88f686b…`](https://github.com/aurixnetwork/aurix-reward-contract/actions/runs/31733936683)
- CI workflow: [`Contract validation`](https://github.com/aurixnetwork/aurix-reward-contract/actions/workflows/ci.yml?query=branch%3Afeature%2Ftestnet-reward-contract-v1)

The optional BscScan Testnet Standard JSON manual submission has been prepared but not submitted. Sourcify is the completed public source-verification service for this baseline.
