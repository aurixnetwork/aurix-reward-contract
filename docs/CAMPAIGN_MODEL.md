# Campaign Model

Each nonzero campaign ID maps to a fixed existence marker plus budget, distributed accounting, per-claim maximum, start/end timestamps, claim interval, and active status.

Creation requires a positive budget and maximum, maximum no greater than budget, `startTime < endTime`, and interval between `1 hours` and `7 days`, inclusive. A campaign ID cannot be recreated.

Narrow manager functions can change active status, live interval, maximum, budget, or end time. A budget cannot be zero, below distributed accounting, or below the current maximum. A maximum cannot be zero or exceed budget. End time must remain after start time.

## Live interval semantics

The contract stores `lastClaimAt[campaignId][claimant]`. A first claim has no interval wait. Later claims require:

```text
block.timestamp >= lastClaimAt[campaignId][claimant] + campaign.claimInterval
```

The current interval is read at claim time. Reducing seven days to one hour can make an existing claimant eligible sooner. Increasing one hour to seven days can extend the existing wait. Each campaign and claimant pair is independent; no Node.js scheduler can override this on-chain rule.

Campaign time windows include their boundaries: claims are allowed at start time and end time when all other checks pass.
