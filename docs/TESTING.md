# Testing

The local suite uses Hardhat's deterministic in-process network and a fixture named `TestERC20`. This fixture is not IRB, is not an Aurix token, and must never be deployed to BSC Testnet. It provides controlled false-return and callback behavior for atomicity/reentrancy tests.

Run:

```bash
npm ci
npm run compile
npm run lint
npm test
npm run coverage
```

The suite is split into deployment/views, EIP-712 authorization, replay, campaign intervals, campaign management, roles, pause, treasury, and security edge cases. It covers successful accounting and events; manipulation of every signed field; other-chain/deployment domains; signer rotation; global ID and campaign-wallet nonce replays; authorization/campaign/interval boundaries; immediate interval changes; role separation; paused recovery; insufficient balance; failed transfer rollback; reentrancy; and direct-BNB rejection.

Coverage percentages can be skewed by generated/test fixtures and do not demonstrate the absence of vulnerabilities. See `reports/TEST_REPORT.md` for the latest recorded local run.
