# ABI Compatibility

The version 1 ABI is exported from `AurixRewardClaim` with:

```bash
npm run export:abi
```

The committed output is `abi/AurixRewardClaim.json`. The source interface is `contracts/interfaces/IAurixRewardClaim.sol`.

Compatibility-sensitive elements include constructor argument order; `RewardAuthorization` and `Campaign` tuple order/types; EIP-712 name/version/type string; public role/interval/type-hash constants; claim/admin/view functions; public mapping getters; custom errors; and events.

The contract is non-upgradeable, so a change to deployed behavior requires a new deployment. Any future source change that alters the ABI or signed type must be documented in `CHANGELOG.md`, regenerate the ABI, receive a new semantic version decision, and be coordinated with backend/client consumers. Version 1 signatures are deployment/domain-specific and cannot be reused on a replacement deployment.
