# Testing

The local suite uses Hardhat's deterministic in-process network and a fixture named `TestERC20`. This fixture is not IRB, is not an Aurix token, and must never be deployed to BSC Testnet. It provides controlled false-return and callback behavior for atomicity/reentrancy tests.

Run:

```bash
npm ci
npm run compile
npm run lint
npm run secretlint
npm run validate:baseline
npm test
npm run coverage
```

The suite is split into deployment/views, EIP-712 authorization, replay, campaign intervals, campaign management, roles, pause, treasury, security edge cases, frozen-baseline identity, network profiles, and Mainnet readiness. It covers successful accounting and events; manipulation of every signed field; other-chain/deployment domains; deterministic Testnet/Mainnet signature isolation; signer rotation; global ID and campaign-wallet nonce replays; authorization/campaign/interval boundaries; immediate interval changes; role separation; paused recovery; insufficient balance; failed transfer rollback; reentrancy; direct-BNB rejection; wrong-chain/token/metadata/profile failures; deployment guard behavior; artifact isolation; required role inputs; zero-write readiness; and safe output.

Coverage percentages can be skewed by generated/test fixtures and do not demonstrate the absence of vulnerabilities. See `reports/TEST_REPORT.md` for the latest recorded local run.
