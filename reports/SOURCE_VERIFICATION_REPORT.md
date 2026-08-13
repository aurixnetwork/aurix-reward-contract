# BSC Testnet Source Verification Report

## Execution result

Passed. The existing `AurixRewardClaim` deployment was verified through Sourcify API v2 without deploying a contract or sending a blockchain transaction.

| Field | Result |
| --- | --- |
| Network | BNB Smart Chain Testnet |
| Chain ID | `97` |
| Contract | `AurixRewardClaim` |
| Address | `0x355D58c905f42F4f78abCD7413371F6EE4Dba137` |
| Deployment transaction | `0x8733558c29a8b7c705a4b26a393105111ce2ad3a665a4b6d2574e2817d5f400c` |
| Deployed-source Git commit | `71bfbfa4252430bda6c907e5a7e78bedfa175116` |
| Verification service | Sourcify API v2 |
| Verification job | `1017a9b7-bfc4-4981-a6c6-33e5499ff93f` |
| Sourcify match ID | `43607722` |
| Verified UTC | `2026-08-13T18:55:11Z` |
| Overall match | `exact_match` |
| Creation match | `exact_match` |
| Runtime match | `exact_match` |
| Public reference | <https://repo.sourcify.dev/97/0x355D58c905f42F4f78abCD7413371F6EE4Dba137> |

Sourcify's current documentation states that API v1 is unavailable, while the installed official Hardhat 2 plugin `@nomicfoundation/hardhat-verify@2.1.3` still uses that legacy endpoint. The compatible Hardhat 2 release line has no newer plugin version. The project therefore uses a narrow Hardhat script that takes the unmodified compiler input from Hardhat build info and submits it to Sourcify's documented v2 Standard JSON endpoint.

## Compiler and source identity

The deployment artifact, Hardhat config, Hardhat build info, local artifact, deployment transaction, and public Sourcify record agree on:

- Solidity `0.8.28`, long version `0.8.28+commit.7893614a`
- optimizer enabled, `200` runs
- EVM version `paris`
- `viaIR: false`
- target `contracts/AurixRewardClaim.sol:AurixRewardClaim`
- `29` compiler-input source files
- Standard JSON input SHA-256 `754cf71c3f282b89c1efff2f9f6a3b48b6590ad40346dc7bbbe516ed352b7fc6`

The Solidity source tree, Hardhat compiler config, package lock, and exported ABI are unchanged from deployed-source commit `71bfbfa4252430bda6c907e5a7e78bedfa175116`. Existing post-deployment evidence records normalized runtime hash `0xd8decd4f4c3746f31fc8900213981b44916a5de43e07c73fe1de5bd58f2e43bf`.

An independent Sourcify v2 repository query after submission confirmed the exact chain/address match, all `29` source files including `contracts/AurixRewardClaim.sol`, compiler identity and settings, `98` ABI entries matching the local artifact, and the correct deployment transaction/block/deployer. The public response SHA-256 was `c191bd0655a5eb77061ae2ea616a76705744fe9e073d35f2e7a88119931f0bbc`.

## Constructor verification

The seven constructor arguments were read from the reviewed deployment artifact, ABI encoded, and compared with the constructor-data suffix of the actual deployment transaction. They matched exactly. No constructor value was sourced from an unreviewed environment variable.

## BscScan manual verification readiness

`verification/bscscan-testnet/` is ready for Solidity Standard JSON Input verification and contains:

- exact `standard-json-input.json`
- Solidity compiler `metadata.json`
- `abi.json`
- readable and ABI-encoded constructor arguments
- compiler/settings/address manifest
- manual BscScan form instructions

The package is public-only, uses MIT license metadata, and is not a flattened approximation. It has not been manually submitted to BscScan. Sourcify's job response returned an external Etherscan-family verification identifier; its status URL returned `Missing/Invalid API Key`, and direct BscScan access returned HTTP 403 in this environment, so that mirror's outcome was not independently confirmed. No project API key was added or used. The prepared manual package remains the controlled fallback.

## Project validation

- `npm run compile`: passed
- `npm run lint`: passed
- `npm test`: passed, `67` passing and `0` failing
- `npm run validate:testnet:deployment`: passed
- `npm run verify:testnet:sourcify`: passed against the public repository
- `npm run prepare:bscscan:testnet`: passed

- Contract behavior changed: **NO**
- ABI changed: **NO**
- Deployed bytecode changed: **NO**

## Security and transaction confirmation

The read-only verification network contains zero configured signer accounts. No private key, RPC URL, API key, mnemonic, `.env` content, or other credential is included in the verification tooling, reports, or BscScan package.

Blockchain transactions sent during Phase 2-6: **0**.
