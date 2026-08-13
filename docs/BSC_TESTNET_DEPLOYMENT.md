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

## Automated Etherscan V2 verification

Review the generated report, set `DEPLOYMENT_FILE` to it, then—only with owner authorization—run:

```bash
npm run verify:testnet
```

Verification is restricted to configured BSC Testnet chain ID 97. Published addresses belong in a reviewed deployment report; `deployments/bsc-testnet.example.json` is only a schema example and contains no deployed address.

The Etherscan-specific command uses the Etherscan V2 multichain API and requires `ETHERSCAN_API_KEY`. The deployment report path must be supplied through `DEPLOYMENT_FILE`. This path is preserved for later use and was not invoked during Sourcify verification. No claim about Etherscan account-plan availability or pricing is made here; operators must check current explorer terms before using it.

## Sourcify verification

Sourcify verification does not require an API key or blockchain transaction. `AurixRewardClaim` is publicly indexed as an exact creation and runtime match:

<https://repo.sourcify.dev/97/0x355D58c905f42F4f78abCD7413371F6EE4Dba137>

Repeat the read-only public verification check with:

```bash
npm run verify:testnet:sourcify
```

The command uses Sourcify API v2 because the official Hardhat 2 verification plugin's legacy Sourcify API v1 path is no longer available. It still derives the exact Standard JSON compiler input from Hardhat build info, validates it against the deployment artifact and creation transaction, and runs on `bscTestnetReadOnly`, which has zero configured signer accounts.

## Manual BscScan verification

`verification/bscscan-testnet/` contains the exact Standard JSON compiler input, ABI, compiler metadata, encoded constructor arguments, manifest, and form instructions. This package is ready for manual BscScan Testnet source publication but has not been manually submitted. It is not a flattened approximation.

Automated Etherscan V2 verification, Sourcify verification, and manual BscScan Standard JSON verification are separate publication paths. None sends a blockchain transaction.

## Read-only post-deployment validation

With the deployment RPC configured, run:

```bash
npm run validate:testnet:deployment
```

The command derives the artifact when `deployments/` contains exactly one address-specific BSC Testnet JSON file. To select one explicitly, set `DEPLOYMENT_ARTIFACT` to its path. It validates the artifact schema and credential absence, chain ID, transaction/receipt and constructor data, local creation/runtime bytecode, IRB bytecode and metadata, EIP-712 domain, positive and negative role assignments, pause state, deployment fee, and deployer balance. It uses provider reads and contract calls only and sends zero transactions.

## Post-deployment checklist

Sourcify source and compiler settings and the read-only IRB/domain/role validations are complete. BscScan manual publication, token funding, campaign configuration, explorer labels, monitoring, role migration, and any minimal testnet claim remain separate explicitly approved operational steps.
