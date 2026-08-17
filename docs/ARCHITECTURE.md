# Architecture

## Components

- Aurix backend: performs off-chain eligibility evaluation and constructs authorizations.
- Approver EOA: signs the EIP-712 authorization and holds only `APPROVER_ROLE` by default.
- Claimant wallet: sends the final transaction, pays gas, and receives tokens.
- `AurixRewardClaim`: final authorization, replay, campaign, interval, and balance gate.
- IRB token: immutable configured BEP-20 transferred with SafeERC20.

## Claim state transition

`claimReward` validates fixed fields, timing, campaign state, current interval, budget, contract token balance, signature, and current Approver membership. It then marks the global reward ID, increments the campaign-wallet nonce, records the claim timestamp, and increases distributed accounting before calling the token. EVM transaction atomicity rolls those effects back if SafeERC20 transfer fails.

The reward recipient is never configurable per claim: it is always `authorization.claimant`, which must be `msg.sender`.

## Deliberate exclusions

Version 1 has no proxy, upgrade hook, minting, token pricing, investment/return logic, arbitrary external call, `delegatecall`, `tx.origin`, relayed claimant transaction, separate UserRequest signature, or native-BNB deposit path.

Operational policies such as first-reward-only, once-per-campaign, recurring dispatch, dispatch intervals, wallet queues, Ethereum transaction-nonce coordination, durable run state, run pause/resume, wallet selection, and pilot batch processing belong to the reward server. They are not Mainnet contract-readiness features and are not added to Solidity.

## Compilation

The pinned compiler is Solidity 0.8.28 with optimizer enabled for 200 runs, Paris EVM target, and `viaIR` disabled. The contract is non-upgradeable and constructor-configured.
