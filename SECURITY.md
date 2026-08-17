# Security Policy

## Scope and status

`AurixRewardClaim` is a new, separate smart contract. The existing Beosin audit for the AURX token does not review or cover this repository. Automated tests, coverage, linting, and static analysis reduce some implementation risk but are not an audit and do not guarantee security.

Before a production or mainnet use, commission an independent smart-contract audit, review operational signing controls, validate role holders, test the exact deployed bytecode and token integration, and use a staged rollout with monitoring.

## Reporting a vulnerability

Do not disclose an unremediated vulnerability through a public issue. Send a private report to the Aurix Network project team through an official private contact channel. Include affected commit/deployment, impact, reproduction steps, and a suggested remediation if available. Do not include private keys, seed phrases, RPC credentials, or user data.

The project team should acknowledge a report, assess severity, coordinate a fix and disclosure timeline, and credit the reporter when requested and appropriate. No bug-bounty payment is promised by this policy.

## Operational safeguards

- Never commit or transmit deployer/Approver keys in repository files or logs.
- Use an isolated Approver EOA or managed signer that holds no unrelated role.
- Migrate critical administration and treasury roles to reviewed multisigs before production.
- Pause first for any configured-token withdrawal.
- Treat reward IDs as globally unique and nonces as campaign-wallet state.
- Inspect the preflight and deployment reports before verification or role handover.
- Do not deploy this version to BSC Mainnet without explicit owner approval and separate readiness review.
- Keep `MAINNET_DEPLOYMENT_ENABLED` false except on the single explicitly authorized deployment invocation.
- Never reuse Testnet RPC, token, reward-contract, deployer, or role configuration silently in the Mainnet profile.
- Treat any frozen Solidity source, interface, ABI, or compiler identity mismatch as a deployment stop condition.

See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for the trust model and known limitations.
