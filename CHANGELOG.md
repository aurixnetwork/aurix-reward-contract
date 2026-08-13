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
- Etherscan V2 multichain configuration for post-deployment BSC Testnet source verification.
- ABI export, public documentation, coverage tooling, Solidity linting, and GitHub Actions CI.

### Security

- State and accounting changes precede SafeERC20 transfer and revert with transfer failure.
- The Solidity compiler targets Paris explicitly; `viaIR` remains disabled.

## 0.0.0 - 2026-08-06

- Initial public repository structure.
