# Local Test Report

- Date: 2026-08-14 (Asia/Seoul workspace date)
- Network: deterministic local Hardhat network, chain ID 31337
- Compiler: Solidity 0.8.28, optimizer 200, Paris, no viaIR
- Result: 67 passing, 0 failing
- Scope: deployment, authorization, replay, intervals, campaigns, roles, pause, treasury, and security edge cases
- BSC transaction: none
- Coverage: 100% statements, 87.68% branches, 100% functions, 100% lines (all files)
- BSC Testnet preflight: passed read-only for chain ID 97 and IRISBANK / IRB at the fixed token address
- BSC Testnet deployment readiness: passed with zero transactions; see `DEPLOYMENT_READINESS_REPORT.md`

This report records automated behavior checks, not an audit or security certification.
