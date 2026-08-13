# BSC Testnet Deployment

`AurixRewardClaim` is deployed on BSC Testnet at `0x355D58c905f42F4f78abCD7413371F6EE4Dba137`. Setup, tests, CI, preflight, validation, and ABI export do not deploy or mutate the contract. BSC Mainnet is out of scope.

## Required environment

Copy `.env.example` to the ignored `.env` and populate the BSC Testnet RPC and deployer key. Review the fixed initial
role addresses and confirmations. An Etherscan V2 API key is required only for the later explorer-verification command. Never
commit or print credentials.

## Read-only IRB preflight

```bash
npm run preflight:irb
```

The script aborts unless RPC chain ID is 97, the configured token is exactly `0x7daf7fE962B123A6698D5e3a109c551872790AeA`, bytecode exists, metadata is readable, name is IRISBANK, and symbol is IRB. It prints decimals/total supply and writes `reports/irb-testnet-preflight.json`. It uses no key and sends no transaction.

## Zero-transaction deployment readiness

```bash
npm run deploy:testnet:check
```

This command repeats the IRB preflight, requires the configured private key to derive the reviewed deployer
`0x2A37820df48d298De3907557b02301A46C2e127f`, validates every fixed constructor role address, reads the deployer's
tBNB balance and current RPC gas price, estimates deployment gas with `eth_estimateGas`, and checks bytecode limits. It
prints the planned constructor mapping and exits nonzero if the balance is below the estimate plus a 20% gas margin. It
constructs only an unsigned deployment request and sends zero transactions.

## Prepared deployment command

After owner approval for a testnet transaction and manual review of all addresses:

```bash
npm run deploy:testnet
```

The deployment script repeats preflight, validates the exact reviewed deployer and constructor addresses, waits configured
confirmations, verifies the immutable token, domain identity, initial roles, and Approver role separation, then writes a
JSON report containing transaction/block/deployer/arguments/compiler/packages/Git commit/time and observed IRB metadata.
It never prints a private key.

## Prepared explorer verification

Review the generated report, set `DEPLOYMENT_FILE` to it, then—only with owner authorization—run:

```bash
npm run verify:testnet
```

Verification is restricted to configured BSC Testnet chain ID 97. Published addresses belong in a reviewed deployment report; `deployments/bsc-testnet.example.json` is only a schema example and contains no deployed address.

The current Hardhat verification mechanism uses the Etherscan V2 multichain API and requires `ETHERSCAN_API_KEY`; it is
not optional. Etherscan currently lists BNB Smart Chain Testnet API access as paid-tier only. The ignored deployment report
path must be supplied through `DEPLOYMENT_FILE`. Verification also requires the deployed contract to have bytecode and
the locally compiled source/settings and constructor arguments to match that deployment. Sourcify is disabled in
`hardhat.config.ts`, so there is no configured keyless verification fallback.

## Read-only post-deployment validation

With the deployment RPC configured, run:

```bash
npm run validate:testnet:deployment
```

The command derives the artifact when `deployments/` contains exactly one address-specific BSC Testnet JSON file. To select one explicitly, set `DEPLOYMENT_ARTIFACT` to its path. It validates the artifact schema and credential absence, chain ID, transaction/receipt and constructor data, local creation/runtime bytecode, IRB bytecode and metadata, EIP-712 domain, positive and negative role assignments, pause state, deployment fee, and deployer balance. It uses provider reads and contract calls only and sends zero transactions.

## Post-deployment checklist

Verify source, bytecode/compiler settings, IRB metadata, domain, all role members/admins, token funding, campaign settings, explorer labels, and monitoring. Transfer administrative roles to reviewed multisigs where appropriate. Revoke temporary roles deliberately. Run a separately approved minimal testnet claim before wider use.
