# BSC Testnet Deployment Preparation

No deployment is performed by setup, tests, CI, preflight, or ABI export. BSC Mainnet is out of scope.

## Required environment

Copy `.env.example` to the ignored `.env` and populate BSC Testnet RPC, deployer key, reviewed initial role addresses, confirmations, and (only for later verification) a BscScan API key. Never commit or print these values.

## Read-only IRB preflight

```bash
npm run preflight:irb
```

The script aborts unless RPC chain ID is 97, the configured token is exactly `0x7daf7fE962B123A6698D5e3a109c551872790AeA`, bytecode exists, metadata is readable, name is IRISBANK, and symbol is IRB. It prints decimals/total supply and writes `reports/irb-testnet-preflight.json`. It uses no key and sends no transaction.

## Prepared deployment command

After owner approval for a testnet transaction and manual review of all addresses:

```bash
npm run deploy:testnet
```

The deployment script repeats preflight, validates all constructor addresses, waits configured confirmations, verifies the immutable token, domain identity, and initial roles, then writes a JSON report containing transaction/block/deployer/arguments/compiler/packages/Git commit/time and observed IRB metadata. It never prints a private key.

## Prepared explorer verification

Review the generated report, set `DEPLOYMENT_FILE` to it, then—only with owner authorization—run:

```bash
npm run verify:testnet
```

Verification is restricted to configured BSC Testnet chain ID 97. Published addresses belong in a reviewed deployment report; `deployments/bsc-testnet.example.json` is only a schema example and contains no deployed address.

## Post-deployment checklist

Verify source, bytecode/compiler settings, IRB metadata, domain, all role members/admins, token funding, campaign settings, explorer labels, and monitoring. Transfer administrative roles to reviewed multisigs where appropriate. Revoke temporary roles deliberately. Run a separately approved minimal testnet claim before wider use.
