// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Local-only deterministic ERC-20 fixture. It must never be deployed to BSC Testnet.
contract TestERC20 is ERC20 {
    bool public failTransfers;
    address public reentryTarget;
    bytes public reentryData;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor() ERC20("Local Test Token", "LTT") {}

    /// @notice Mints local test units.
    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    /// @notice Makes transfer return false for rollback testing.
    function setFailTransfers(bool shouldFail) external {
        failTransfers = shouldFail;
    }

    /// @notice Configures one callback attempt during transfer for reentrancy testing.
    function configureReentry(address target, bytes calldata data) external {
        reentryTarget = target;
        reentryData = data;
        reentryAttempted = false;
        reentrySucceeded = false;
    }

    /// @inheritdoc ERC20
    function transfer(address to, uint256 value) public override returns (bool) {
        if (failTransfers) return false;
        if (reentryTarget != address(0) && !reentryAttempted) {
            reentryAttempted = true;
            (reentrySucceeded,) = reentryTarget.call(reentryData);
        }
        return super.transfer(to, value);
    }
}
