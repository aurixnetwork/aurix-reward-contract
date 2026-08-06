# EIP-712 Reward Authorization

## Domain

```text
name: AurixRewardClaim
version: 1
chainId: current chain ID
verifyingContract: deployed AurixRewardClaim address
```

## Primary type

```text
RewardAuthorization(
  address claimant,
  uint256 amount,
  bytes32 campaignId,
  bytes32 rewardId,
  uint256 rewardNonce,
  uint256 validAfter,
  uint256 deadline
)
```

Canonical type string:

```text
RewardAuthorization(address claimant,uint256 amount,bytes32 campaignId,bytes32 rewardId,uint256 rewardNonce,uint256 validAfter,uint256 deadline)
```

Amounts are token base units. `campaignId` and `rewardId` are nonzero bytes32 values, not human labels. `rewardNonce` is the exact current `rewardNonces[campaignId][claimant]`; it is unrelated to an account's transaction nonce. The authorization is usable at `validAfter` and through `deadline`, inclusive, provided `deadline >= validAfter`.

The recovered signer must hold `APPROVER_ROLE` when the claim executes. Granting or revoking that role immediately affects all unconsumed signatures from that signer.

There is no separate claimant off-chain signature in v1. The claimant signs/sends the on-chain transaction.
