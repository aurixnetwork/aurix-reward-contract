# Changelog

All notable changes are recorded here. This project follows semantic versioning for documented ABI releases.

## Unreleased

### Added

- Non-upgradeable `AurixRewardClaim` v1 with EIP-712 Approver authorization and claimant self-claim.
- Global reward ID and per-campaign/per-wallet nonce replay protection.
- Independently budgeted campaigns with configurable one-hour to seven-day claim intervals.
- Separated Approver, campaign, pause, administration, and treasury roles.
- Paused-only reward-token withdrawal, unrelated ERC-20 recovery, and direct BNB rejection.
- Deterministic authorization, replay, interval, campaign, role, pause, treasury, and security tests.
- Read-only IRB testnet preflight and prepared BSC Testnet deployment/verification scripts.
- Zero-transaction BSC Testnet deployment readiness checks with fixed role validation, gas estimation, and bytecode sizing.
- Read-only BSC Testnet post-deployment validation with artifact, bytecode, token, EIP-712, role, pause-state, and receipt checks.
- Exact-match Sourcify source publication and a reproducible BscScan Testnet Standard JSON verification package.
- Finalized public BSC Testnet deployment status, stable current-deployment metadata, and consumer ABI references.
- Etherscan V2 multichain configuration for post-deployment BSC Testnet source verification.
- ABI export, public documentation, coverage tooling, Solidity linting, and GitHub Actions CI.
- Explicit, fail-closed BSC Testnet/Mainnet profiles with isolated RPC and deployment artifacts.
- Read-only BSC Mainnet readiness checks for chain ID, AURX bytecode/metadata, roles, deployer balance, gas price, compiler baseline, and constructor display.
- A one-shot Mainnet deployment guard, guarded future deployment script, read-only post-deployment validator, and Mainnet source-verification path.
- Frozen Solidity/interface/ABI hash validation and deterministic Testnet/Mainnet EIP-712 signature-domain isolation tests.
- Mainnet environment and deployment-artifact examples with no credentials or invented production addresses.
- Secretlint scanning and production dependency audit in CI.

### Security

- State and accounting changes precede SafeERC20 transfer and revert with transfer failure.
- The Solidity compiler targets Paris explicitly; `viaIR` remains disabled.

## 0.0.0 - 2026-08-06

- Initial public repository structure.
