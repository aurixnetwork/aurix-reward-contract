// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IAurixRewardClaim
/// @notice Stable external interface for the non-upgradeable Aurix reward claim contract.
interface IAurixRewardClaim {
    /// @notice A backend-approved reward claim bound into an EIP-712 signature.
    struct RewardAuthorization {
        address claimant;
        uint256 amount;
        bytes32 campaignId;
        bytes32 rewardId;
        uint256 rewardNonce;
        uint256 validAfter;
        uint256 deadline;
    }

    /// @notice Configuration and accounting for one independent campaign.
    struct Campaign {
        uint256 budget;
        uint256 distributed;
        uint256 maxRewardAmount;
        uint64 startTime;
        uint64 endTime;
        uint64 claimInterval;
        bool active;
        bool exists;
    }

    event RewardClaimed(
        bytes32 indexed campaignId,
        bytes32 indexed rewardId,
        address indexed claimant,
        address approver,
        uint256 amount,
        uint256 consumedRewardNonce,
        uint256 claimTimestamp
    );
    event CampaignCreated(
        bytes32 indexed campaignId,
        uint256 budget,
        uint256 maxRewardAmount,
        uint64 startTime,
        uint64 endTime,
        uint64 claimInterval,
        bool active
    );
    event CampaignActiveStatusUpdated(bytes32 indexed campaignId, bool oldActive, bool newActive);
    event CampaignIntervalUpdated(bytes32 indexed campaignId, uint64 oldInterval, uint64 newInterval);
    event CampaignMaxRewardUpdated(bytes32 indexed campaignId, uint256 oldMaximum, uint256 newMaximum);
    event CampaignBudgetUpdated(bytes32 indexed campaignId, uint256 oldBudget, uint256 newBudget);
    event CampaignEndTimeUpdated(bytes32 indexed campaignId, uint64 oldEndTime, uint64 newEndTime);
    event RewardTokenWithdrawn(address indexed recipient, uint256 amount);
    event UnrelatedTokenRecovered(address indexed token, address indexed recipient, uint256 amount);

    /// @notice Returns the configured reward token.
    function rewardToken() external view returns (IERC20);

    /// @notice Claims a reward using a current Approver's EIP-712 signature.
    function claimReward(RewardAuthorization calldata authorization, bytes calldata approverSignature) external;

    /// @notice Creates a new campaign.
    function createCampaign(
        bytes32 campaignId,
        uint256 budget,
        uint256 maxRewardAmount,
        uint64 startTime,
        uint64 endTime,
        uint64 claimInterval,
        bool active
    ) external;

    /// @notice Sets whether an existing campaign may pay rewards.
    function setCampaignActive(bytes32 campaignId, bool active) external;

    /// @notice Replaces an existing campaign's claim interval.
    function setCampaignClaimInterval(bytes32 campaignId, uint64 newInterval) external;

    /// @notice Replaces an existing campaign's maximum per-claim reward.
    function setCampaignMaxRewardAmount(bytes32 campaignId, uint256 newMaximum) external;

    /// @notice Safely replaces an existing campaign's total budget.
    function setCampaignBudget(bytes32 campaignId, uint256 newBudget) external;

    /// @notice Replaces an existing campaign's end time.
    function setCampaignEndTime(bytes32 campaignId, uint64 newEndTime) external;

    /// @notice Pauses claims and enables paused-only treasury recovery.
    function pause() external;

    /// @notice Unpauses claims; callable only by the default administrator.
    function unpause() external;

    /// @notice Withdraws configured reward tokens while paused.
    function withdrawRewardToken(address recipient, uint256 amount) external;

    /// @notice Recovers an unrelated ERC-20 token while paused.
    function recoverUnrelatedToken(IERC20 token, address recipient, uint256 amount) external;

    /// @notice Returns one campaign.
    function getCampaign(bytes32 campaignId) external view returns (Campaign memory);

    /// @notice Returns the next expected nonce for a campaign and claimant.
    function getRewardNonce(bytes32 campaignId, address claimant) external view returns (uint256);

    /// @notice Returns the last successful claim timestamp.
    function getLastClaimAt(bytes32 campaignId, address claimant) external view returns (uint256);

    /// @notice Returns zero for a first claim, otherwise the current next-claim timestamp.
    function getNextClaimAt(bytes32 campaignId, address claimant) external view returns (uint256);

    /// @notice Returns whether the current campaign interval has elapsed.
    function isClaimIntervalElapsed(bytes32 campaignId, address claimant) external view returns (bool);

    /// @notice Returns the EIP-712 domain name.
    function eip712Name() external pure returns (string memory);

    /// @notice Returns the EIP-712 domain version.
    function eip712Version() external pure returns (string memory);
}
