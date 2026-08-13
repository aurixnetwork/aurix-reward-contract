# BSC Testnet Deployment Readiness Report

- Validation date: 2026-08-14 (Asia/Seoul)
- Network: BNB Smart Chain Testnet
- Chain ID: 97
- Result: ready for an explicitly authorized deployment; no transaction was sent
- Deployer: `0x2A37820df48d298De3907557b02301A46C2e127f`
- Deployer balance: 0.1 tBNB

## IRB RPC validation

- Address: `0x7daf7fE962B123A6698D5e3a109c551872790AeA`
- Runtime code size: 5,109 bytes
- Name: IRISBANK
- Symbol: IRB
- Decimals: 18
- Total supply (base units): `20000000000000000000000000000`

## Planned constructor

1. `rewardTokenAddress`: `0x7daf7fE962B123A6698D5e3a109c551872790AeA`
2. `initialAdmin`: `0x2A37820df48d298De3907557b02301A46C2e127f`
3. `initialApproverManager`: `0x2A37820df48d298De3907557b02301A46C2e127f`
4. `initialApprover`: `0x425f7117D36aC8F45224E895e583b404E0a6eb05`
5. `initialCampaignManager`: `0x9B2fB8ED115242477C9a8Ea511a0D85E122E1FbE`
6. `initialPauser`: `0x9B2fB8ED115242477C9a8Ea511a0D85E122E1FbE`
7. `initialTreasury`: `0x2A37820df48d298De3907557b02301A46C2e127f`

The private key was validated locally to derive the reviewed deployer address and was not printed or recorded.

## Gas and bytecode

- RPC deployment estimate: 2,761,122 gas
- RPC gas price: 0.1 gwei
- Estimated cost: 0.0002761122 tBNB
- Estimated requirement with 20% gas margin: 0.0003313346 tBNB
- Balance assessment: 0.1 tBNB is comfortably sufficient
- Creation bytecode: 13,347 bytes
- Complete deployment initcode including constructor arguments: 13,571 bytes
- Deployed bytecode: 11,304 bytes of the 24,576-byte EIP-170 limit

## Artifacts and verification

A successful deployment will write `deployments/bsc-testnet-<deployed-contract-address>.json`. The report contains public
deployment data and toolchain metadata, not private keys, RPC URLs, or explorer credentials.

The configured post-deployment verifier uses Etherscan API V2 for chain ID 97. `ETHERSCAN_API_KEY` and a reviewed
`DEPLOYMENT_FILE` will be required after deployment. The API key is currently unset. No verification was attempted.
