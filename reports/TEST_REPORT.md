# Local Test Report

- Date: 2026-08-18 (Asia/Seoul workspace date)
- Network: deterministic local Hardhat network, chain ID 31337
- Compiler: Solidity 0.8.28, optimizer 200, Paris, no viaIR
- Result: 95 passing, 0 failing
- Scope: deployment, authorization, replay, intervals, campaigns, roles, pause, treasury, security edge cases, frozen baseline, explicit network profiles, Mainnet readiness, and EIP-712 domain isolation
- BSC transaction: none
- Coverage: 100% statements, 87.68% branches, 100% functions, 100% lines (all files)
- BSC Testnet preflight: passed read-only for chain ID 97 and IRISBANK / IRB at the fixed token address
- BSC Testnet deployment readiness: passed with zero transactions; see `DEPLOYMENT_READINESS_REPORT.md`
- BSC Mainnet read-only validation: chain ID 56 and AURX bytecode/metadata passed; overall readiness remains false because owner addresses are missing and the deployment guard is false
- BSC Mainnet transactions: none

This report records automated behavior checks, not an audit or security certification.
