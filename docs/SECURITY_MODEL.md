# Security Model

## Trust assumptions

The backend determines off-chain eligibility. A currently authorized Approver can authorize payments within on-chain campaign constraints, so Approver-key security is critical. Campaign managers control future and current campaign settings within bounded functions. Treasury can remove tokens only while claims are paused. The default administrator can unpause and administer critical roles.

## On-chain controls

- EIP-712 domain separation by name, version, chain ID, and deployed address.
- Binding of claimant, amount, campaign, global reward ID, campaign-wallet nonce, valid-after, and deadline.
- Current `APPROVER_ROLE` check at execution, enabling signer rotation/revocation.
- Claimant-funded transaction with strict `msg.sender == claimant`.
- Global one-time reward IDs plus exact sequential campaign-wallet nonces.
- Campaign existence, active state, time window, live interval, maximum, and remaining budget.
- Pausing, reentrancy guard, checks-effects-interactions, SafeERC20, and sufficient-balance checks.
- Custom errors, zero-address/zero-ID guards, separated roles, and comprehensive events.
- Rejection of direct BNB and unknown calls.

## Remaining risks

- Compromise or misuse of an Approver, manager, admin, pauser, or treasury key.
- Backend eligibility errors that still fall within on-chain constraints.
- Non-standard or malicious reward-token behavior despite SafeERC20 and reentrancy protection.
- Timestamp dependence within normal validator latitude.
- Incorrect constructor role addresses or inadequate role handover.
- Signature-distribution privacy and operational replay attempts (which revert but consume claimant gas).
- Compiler, dependency, BSC EVM, explorer, and infrastructure risks.
- Lack of an independent audit for this contract.

Tests are evidence of tested behavior only. They are not proof of correctness or security.
