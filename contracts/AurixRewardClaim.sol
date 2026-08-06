// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAurixRewardClaim} from "./interfaces/IAurixRewardClaim.sol";

/// @title AurixRewardClaim
/// @author Aurix Network
/// @notice Validates Approver EIP-712 authorizations and pays rewards through claimant-funded self-claims.
/// @dev Non-upgradeable v1. Token quantities are always expressed in the configured token's base units.
contract AurixRewardClaim is IAurixRewardClaim, AccessControl, EIP712, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Role whose current members may sign reward authorizations.
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    /// @notice Role permitted to grant and revoke APPROVER_ROLE.
    bytes32 public constant APPROVER_MANAGER_ROLE = keccak256("APPROVER_MANAGER_ROLE");
    /// @notice Role permitted to create and narrowly update campaigns.
    bytes32 public constant CAMPAIGN_MANAGER_ROLE = keccak256("CAMPAIGN_MANAGER_ROLE");
    /// @notice Role permitted to pause the contract.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice Role permitted to recover tokens under paused-only restrictions.
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    /// @notice Minimum campaign claim interval.
    uint64 public constant MIN_CLAIM_INTERVAL = 1 hours;
    /// @notice Maximum campaign claim interval.
    uint64 public constant MAX_CLAIM_INTERVAL = 7 days;

    /// @notice Canonical EIP-712 type hash for RewardAuthorization.
    bytes32 public constant REWARD_AUTHORIZATION_TYPEHASH = keccak256(
        "RewardAuthorization(address claimant,uint256 amount,bytes32 campaignId,bytes32 rewardId,"
        "uint256 rewardNonce,uint256 validAfter,uint256 deadline)"
    );

    /// @inheritdoc IAurixRewardClaim
    IERC20 public immutable override rewardToken;

    /// @notice Campaign configuration and accounting by campaign ID.
    mapping(bytes32 campaignId => Campaign campaign) public campaigns;
    /// @notice Global one-time reward ID consumption state.
    mapping(bytes32 rewardId => bool used) public usedRewardIds;
    /// @notice Next required nonce by campaign ID and claimant.
    mapping(bytes32 campaignId => mapping(address claimant => uint256 nonce)) public rewardNonces;
    /// @notice Last successful claim timestamp by campaign ID and claimant.
    mapping(bytes32 campaignId => mapping(address claimant => uint256 timestamp)) public lastClaimAt;

    error ZeroAddress();
    error ZeroCampaignId();
    error ZeroRewardId();
    error ZeroAmount();
    error NativeTokenNotAccepted();
    error ClaimantMismatch(address sender, address claimant);
    error RewardIdAlreadyUsed(bytes32 rewardId);
    error InvalidRewardNonce(uint256 expected, uint256 provided);
    error InvalidAuthorizationWindow(uint256 validAfter, uint256 deadline);
    error AuthorizationNotYetValid(uint256 validAfter);
    error AuthorizationExpired(uint256 deadline);
    error CampaignAlreadyExists(bytes32 campaignId);
    error CampaignDoesNotExist(bytes32 campaignId);
    error InvalidCampaignBudget(uint256 budget);
    error InvalidCampaignMaximum(uint256 maximum, uint256 budget);
    error InvalidCampaignTimeRange(uint64 startTime, uint64 endTime);
    error InvalidClaimInterval(uint64 interval);
    error CampaignInactive(bytes32 campaignId);
    error CampaignNotStarted(uint64 startTime);
    error CampaignEnded(uint64 endTime);
    error ClaimIntervalNotElapsed(uint256 nextClaimAt);
    error RewardExceedsMaximum(uint256 amount, uint256 maximum);
    error CampaignBudgetExceeded(uint256 remaining, uint256 requested);
    error InsufficientRewardTokenBalance(uint256 balance, uint256 required);
    error InvalidApprover(address recoveredSigner);
    error BudgetBelowDistributed(uint256 distributed, uint256 proposedBudget);
    error BudgetBelowMaximum(uint256 maximum, uint256 proposedBudget);
    error ConfiguredRewardTokenNotRecoverable();
    error InsufficientTokenBalance(uint256 balance, uint256 requested);

    /// @notice Initializes the immutable reward token and separated operational roles.
    /// @param rewardTokenAddress ERC-20/BEP-20 token paid by successful claims.
    /// @param initialAdmin Initial holder of DEFAULT_ADMIN_ROLE.
    /// @param initialApproverManager Initial manager of APPROVER_ROLE membership.
    /// @param initialApprover Initial EOA authorized to sign RewardAuthorization values.
    /// @param initialCampaignManager Initial campaign configuration manager.
    /// @param initialPauser Initial account allowed to pause claims.
    /// @param initialTreasury Initial account allowed to recover tokens under the treasury constraints.
    constructor(
        address rewardTokenAddress,
        address initialAdmin,
        address initialApproverManager,
        address initialApprover,
        address initialCampaignManager,
        address initialPauser,
        address initialTreasury
    ) EIP712("AurixRewardClaim", "1") {
        if (
            rewardTokenAddress == address(0) || initialAdmin == address(0)
                || initialApproverManager == address(0) || initialApprover == address(0)
                || initialCampaignManager == address(0) || initialPauser == address(0)
                || initialTreasury == address(0)
        ) revert ZeroAddress();

        rewardToken = IERC20(rewardTokenAddress);

        _setRoleAdmin(APPROVER_ROLE, APPROVER_MANAGER_ROLE);
        _setRoleAdmin(APPROVER_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(CAMPAIGN_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(TREASURY_ROLE, DEFAULT_ADMIN_ROLE);

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(APPROVER_MANAGER_ROLE, initialApproverManager);
        _grantRole(APPROVER_ROLE, initialApprover);
        _grantRole(CAMPAIGN_MANAGER_ROLE, initialCampaignManager);
        _grantRole(PAUSER_ROLE, initialPauser);
        _grantRole(TREASURY_ROLE, initialTreasury);
    }

    /// @inheritdoc IAurixRewardClaim
    function claimReward(RewardAuthorization calldata authorization, bytes calldata approverSignature)
        external
        override
        whenNotPaused
        nonReentrant
    {
        if (authorization.claimant == address(0)) revert ZeroAddress();
        if (msg.sender != authorization.claimant) {
            revert ClaimantMismatch(msg.sender, authorization.claimant);
        }
        if (authorization.amount == 0) revert ZeroAmount();
        if (authorization.campaignId == bytes32(0)) revert ZeroCampaignId();
        if (authorization.rewardId == bytes32(0)) revert ZeroRewardId();
        if (usedRewardIds[authorization.rewardId]) revert RewardIdAlreadyUsed(authorization.rewardId);

        uint256 expectedNonce = rewardNonces[authorization.campaignId][authorization.claimant];
        if (authorization.rewardNonce != expectedNonce) {
            revert InvalidRewardNonce(expectedNonce, authorization.rewardNonce);
        }
        if (authorization.deadline < authorization.validAfter) {
            revert InvalidAuthorizationWindow(authorization.validAfter, authorization.deadline);
        }
        if (block.timestamp < authorization.validAfter) {
            revert AuthorizationNotYetValid(authorization.validAfter);
        }
        if (block.timestamp > authorization.deadline) revert AuthorizationExpired(authorization.deadline);

        Campaign storage campaign = campaigns[authorization.campaignId];
        if (!campaign.exists) revert CampaignDoesNotExist(authorization.campaignId);
        if (!campaign.active) revert CampaignInactive(authorization.campaignId);
        if (block.timestamp < campaign.startTime) revert CampaignNotStarted(campaign.startTime);
        if (block.timestamp > campaign.endTime) revert CampaignEnded(campaign.endTime);

        uint256 previousClaimAt = lastClaimAt[authorization.campaignId][authorization.claimant];
        if (previousClaimAt != 0) {
            uint256 nextClaimAt = previousClaimAt + campaign.claimInterval;
            if (block.timestamp < nextClaimAt) revert ClaimIntervalNotElapsed(nextClaimAt);
        }

        if (authorization.amount > campaign.maxRewardAmount) {
            revert RewardExceedsMaximum(authorization.amount, campaign.maxRewardAmount);
        }
        uint256 remainingBudget = campaign.budget - campaign.distributed;
        if (authorization.amount > remainingBudget) {
            revert CampaignBudgetExceeded(remainingBudget, authorization.amount);
        }

        uint256 tokenBalance = rewardToken.balanceOf(address(this));
        if (tokenBalance < authorization.amount) {
            revert InsufficientRewardTokenBalance(tokenBalance, authorization.amount);
        }

        bytes32 structHash = keccak256(
            abi.encode(
                REWARD_AUTHORIZATION_TYPEHASH,
                authorization.claimant,
                authorization.amount,
                authorization.campaignId,
                authorization.rewardId,
                authorization.rewardNonce,
                authorization.validAfter,
                authorization.deadline
            )
        );
        address approver = ECDSA.recover(_hashTypedDataV4(structHash), approverSignature);
        if (!hasRole(APPROVER_ROLE, approver)) revert InvalidApprover(approver);

        usedRewardIds[authorization.rewardId] = true;
        rewardNonces[authorization.campaignId][authorization.claimant] = expectedNonce + 1;
        lastClaimAt[authorization.campaignId][authorization.claimant] = block.timestamp;
        campaign.distributed += authorization.amount;

        rewardToken.safeTransfer(authorization.claimant, authorization.amount);

        emit RewardClaimed(
            authorization.campaignId,
            authorization.rewardId,
            authorization.claimant,
            approver,
            authorization.amount,
            expectedNonce,
            block.timestamp
        );
    }

    /// @inheritdoc IAurixRewardClaim
    function createCampaign(
        bytes32 campaignId,
        uint256 budget,
        uint256 maxRewardAmount,
        uint64 startTime,
        uint64 endTime,
        uint64 claimInterval,
        bool active
    ) external override onlyRole(CAMPAIGN_MANAGER_ROLE) {
        if (campaignId == bytes32(0)) revert ZeroCampaignId();
        if (campaigns[campaignId].exists) revert CampaignAlreadyExists(campaignId);
        if (budget == 0) revert InvalidCampaignBudget(budget);
        if (maxRewardAmount == 0 || maxRewardAmount > budget) {
            revert InvalidCampaignMaximum(maxRewardAmount, budget);
        }
        _validateCampaignTimeRange(startTime, endTime);
        _validateClaimInterval(claimInterval);

        campaigns[campaignId] = Campaign({
            budget: budget,
            distributed: 0,
            maxRewardAmount: maxRewardAmount,
            startTime: startTime,
            endTime: endTime,
            claimInterval: claimInterval,
            active: active,
            exists: true
        });

        emit CampaignCreated(campaignId, budget, maxRewardAmount, startTime, endTime, claimInterval, active);
    }

    /// @inheritdoc IAurixRewardClaim
    function setCampaignActive(bytes32 campaignId, bool active)
        external
        override
        onlyRole(CAMPAIGN_MANAGER_ROLE)
    {
        Campaign storage campaign = _requireCampaign(campaignId);
        bool oldActive = campaign.active;
        campaign.active = active;
        emit CampaignActiveStatusUpdated(campaignId, oldActive, active);
    }

    /// @inheritdoc IAurixRewardClaim
    function setCampaignClaimInterval(bytes32 campaignId, uint64 newInterval)
        external
        override
        onlyRole(CAMPAIGN_MANAGER_ROLE)
    {
        _validateClaimInterval(newInterval);
        Campaign storage campaign = _requireCampaign(campaignId);
        uint64 oldInterval = campaign.claimInterval;
        campaign.claimInterval = newInterval;
        emit CampaignIntervalUpdated(campaignId, oldInterval, newInterval);
    }

    /// @inheritdoc IAurixRewardClaim
    function setCampaignMaxRewardAmount(bytes32 campaignId, uint256 newMaximum)
        external
        override
        onlyRole(CAMPAIGN_MANAGER_ROLE)
    {
        Campaign storage campaign = _requireCampaign(campaignId);
        if (newMaximum == 0 || newMaximum > campaign.budget) {
            revert InvalidCampaignMaximum(newMaximum, campaign.budget);
        }
        uint256 oldMaximum = campaign.maxRewardAmount;
        campaign.maxRewardAmount = newMaximum;
        emit CampaignMaxRewardUpdated(campaignId, oldMaximum, newMaximum);
    }

    /// @inheritdoc IAurixRewardClaim
    function setCampaignBudget(bytes32 campaignId, uint256 newBudget)
        external
        override
        onlyRole(CAMPAIGN_MANAGER_ROLE)
    {
        Campaign storage campaign = _requireCampaign(campaignId);
        if (newBudget == 0) revert InvalidCampaignBudget(newBudget);
        if (newBudget < campaign.distributed) {
            revert BudgetBelowDistributed(campaign.distributed, newBudget);
        }
        if (newBudget < campaign.maxRewardAmount) {
            revert BudgetBelowMaximum(campaign.maxRewardAmount, newBudget);
        }
        uint256 oldBudget = campaign.budget;
        campaign.budget = newBudget;
        emit CampaignBudgetUpdated(campaignId, oldBudget, newBudget);
    }

    /// @inheritdoc IAurixRewardClaim
    function setCampaignEndTime(bytes32 campaignId, uint64 newEndTime)
        external
        override
        onlyRole(CAMPAIGN_MANAGER_ROLE)
    {
        Campaign storage campaign = _requireCampaign(campaignId);
        _validateCampaignTimeRange(campaign.startTime, newEndTime);
        uint64 oldEndTime = campaign.endTime;
        campaign.endTime = newEndTime;
        emit CampaignEndTimeUpdated(campaignId, oldEndTime, newEndTime);
    }

    /// @inheritdoc IAurixRewardClaim
    function pause() external override onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @inheritdoc IAurixRewardClaim
    function unpause() external override onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @inheritdoc IAurixRewardClaim
    function withdrawRewardToken(address recipient, uint256 amount)
        external
        override
        onlyRole(TREASURY_ROLE)
        whenPaused
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 balance = rewardToken.balanceOf(address(this));
        if (amount > balance) revert InsufficientTokenBalance(balance, amount);
        rewardToken.safeTransfer(recipient, amount);
        emit RewardTokenWithdrawn(recipient, amount);
    }

    /// @inheritdoc IAurixRewardClaim
    function recoverUnrelatedToken(IERC20 token, address recipient, uint256 amount)
        external
        override
        onlyRole(TREASURY_ROLE)
        whenPaused
        nonReentrant
    {
        if (address(token) == address(0) || recipient == address(0)) revert ZeroAddress();
        if (address(token) == address(rewardToken)) revert ConfiguredRewardTokenNotRecoverable();
        if (amount == 0) revert ZeroAmount();
        uint256 balance = token.balanceOf(address(this));
        if (amount > balance) revert InsufficientTokenBalance(balance, amount);
        token.safeTransfer(recipient, amount);
        emit UnrelatedTokenRecovered(address(token), recipient, amount);
    }

    /// @inheritdoc IAurixRewardClaim
    function getCampaign(bytes32 campaignId) external view override returns (Campaign memory) {
        return _requireCampaign(campaignId);
    }

    /// @inheritdoc IAurixRewardClaim
    function getRewardNonce(bytes32 campaignId, address claimant) external view override returns (uint256) {
        return rewardNonces[campaignId][claimant];
    }

    /// @inheritdoc IAurixRewardClaim
    function getLastClaimAt(bytes32 campaignId, address claimant) external view override returns (uint256) {
        return lastClaimAt[campaignId][claimant];
    }

    /// @inheritdoc IAurixRewardClaim
    function getNextClaimAt(bytes32 campaignId, address claimant) external view override returns (uint256) {
        Campaign storage campaign = _requireCampaign(campaignId);
        uint256 previousClaimAt = lastClaimAt[campaignId][claimant];
        return previousClaimAt == 0 ? 0 : previousClaimAt + campaign.claimInterval;
    }

    /// @inheritdoc IAurixRewardClaim
    function isClaimIntervalElapsed(bytes32 campaignId, address claimant) external view override returns (bool) {
        Campaign storage campaign = _requireCampaign(campaignId);
        uint256 previousClaimAt = lastClaimAt[campaignId][claimant];
        return previousClaimAt == 0 || block.timestamp >= previousClaimAt + campaign.claimInterval;
    }

    /// @inheritdoc IAurixRewardClaim
    function eip712Name() external pure override returns (string memory) {
        return "AurixRewardClaim";
    }

    /// @inheritdoc IAurixRewardClaim
    function eip712Version() external pure override returns (string memory) {
        return "1";
    }

    /// @notice Rejects direct BNB transfers; this contract does not need native currency.
    receive() external payable {
        revert NativeTokenNotAccepted();
    }

    /// @notice Rejects unknown calls and native currency sent with calldata.
    fallback() external payable {
        revert NativeTokenNotAccepted();
    }

    function _requireCampaign(bytes32 campaignId) private view returns (Campaign storage campaign) {
        campaign = campaigns[campaignId];
        if (!campaign.exists) revert CampaignDoesNotExist(campaignId);
    }

    function _validateCampaignTimeRange(uint64 startTime, uint64 endTime) private pure {
        if (startTime >= endTime) revert InvalidCampaignTimeRange(startTime, endTime);
    }

    function _validateClaimInterval(uint64 interval) private pure {
        if (interval < MIN_CLAIM_INTERVAL || interval > MAX_CLAIM_INTERVAL) {
            revert InvalidClaimInterval(interval);
        }
    }
}
