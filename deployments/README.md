# Deployments

## BNB Smart Chain Testnet

- Contract: `AurixRewardClaim`
- Address: `0x355D58c905f42F4f78abCD7413371F6EE4Dba137`
- Deployment transaction: `0x8733558c29a8b7c705a4b26a393105111ce2ad3a665a4b6d2574e2817d5f400c`
- Deployment block: `124887720`
- Metadata: [`bsc-testnet-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json`](bsc-testnet-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json)
- Stable current-deployment reference: [`bsc-testnet-current.json`](bsc-testnet-current.json)
- Public deployment status: [`../docs/TESTNET_DEPLOYMENT_STATUS.md`](../docs/TESTNET_DEPLOYMENT_STATUS.md)
- Read-only validation: [`../reports/POST_DEPLOYMENT_VALIDATION_REPORT.md`](../reports/POST_DEPLOYMENT_VALIDATION_REPORT.md)
- Source verification: [Sourcify exact match](https://repo.sourcify.dev/97/0x355D58c905f42F4f78abCD7413371F6EE4Dba137)
- Source-verification report: [`../reports/SOURCE_VERIFICATION_REPORT.md`](../reports/SOURCE_VERIFICATION_REPORT.md)
- BscScan manual Standard JSON package: [`../verification/bscscan-testnet/`](../verification/bscscan-testnet/)

The address-specific metadata file remains the canonical machine-readable deployment record. `bsc-testnet-current.json` is a safe, stable consumer pointer to that record, while `bsc-testnet.example.json` remains the generic report-shape example. Never add private keys, RPC credentials, API keys, mnemonics, or other credentials to deployment metadata.

## BNB Smart Chain Mainnet

`AurixRewardClaim` is not deployed on Mainnet. Do not invent or publish a Mainnet address. `bsc-mainnet.example.json` defines the future address-specific evidence shape without a contract address, transaction hash, or role holders. A future guarded deployment writes `bsc-mainnet-<contract-address>.json`, never a Testnet path; that output must be manually reviewed before it is committed or referenced as current.
