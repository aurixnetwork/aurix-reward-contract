# BscScan Testnet Standard JSON Verification Package

This package reproduces the exact Solidity compiler input used for the existing `AurixRewardClaim` deployment. It contains public data only and has not been submitted to BscScan.

## BscScan form values

- Network: BNB Smart Chain Testnet (chain ID `97`)
- Deployed address: `0x355D58c905f42F4f78abCD7413371F6EE4Dba137`
- Compiler type: Solidity (Standard-Json-Input)
- Compiler version: `v0.8.28+commit.7893614a`
- Open-source license: MIT
- Contract name/target: `contracts/AurixRewardClaim.sol:AurixRewardClaim`
- Standard JSON input: `standard-json-input.json`
- Constructor arguments (ABI encoded, without `0x`): copy the single line from `constructor-arguments.txt`

The Standard JSON input embeds optimizer enabled with 200 runs, Paris EVM, and `viaIR: false`. Do not change those settings, source paths, source contents, or the compilation target, and do not substitute a flattened contract.

The input SHA-256 is `754cf71c3f282b89c1efff2f9f6a3b48b6590ad40346dc7bbbe516ed352b7fc6`. The seven readable constructor values and both prefixed/unprefixed encodings are recorded in `constructor-arguments.json`.

Manual explorer source publication is an off-chain action and requires no blockchain transaction. Review all form fields and confirm the address is on BSC Testnet before submitting. Do not paste an RPC URL, private key, mnemonic, or API credential into the form or this directory.
