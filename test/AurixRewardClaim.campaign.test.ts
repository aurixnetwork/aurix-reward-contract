import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import {
  CAMPAIGN_A,
  DAY,
  DEFAULT_BUDGET,
  DEFAULT_MAXIMUM,
  HOUR,
  WEEK,
  campaignFixture,
  createCampaign,
  deployFixture,
  signedAuthorization,
} from "./helpers";

describe("AurixRewardClaim: campaign controls", function () {
  it("emits CampaignCreated with complete settings", async function () {
    const context = await loadFixture(deployFixture);
    const now = await time.latest();
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      CAMPAIGN_A, DEFAULT_BUDGET, DEFAULT_MAXIMUM, now, now + DAY, HOUR, true,
    )).to.emit(context.reward, "CampaignCreated").withArgs(
      CAMPAIGN_A, DEFAULT_BUDGET, DEFAULT_MAXIMUM, now, now + DAY, HOUR, true,
    );
  });

  it("rejects duplicate and zero campaign IDs", async function () {
    const context = await loadFixture(campaignFixture);
    const now = await time.latest();
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      CAMPAIGN_A, DEFAULT_BUDGET, DEFAULT_MAXIMUM, now, now + DAY, HOUR, true,
    )).to.be.revertedWithCustomError(context.reward, "CampaignAlreadyExists");
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      ethers.ZeroHash, 1, 1, now, now + DAY, HOUR, true,
    )).to.be.revertedWithCustomError(context.reward, "ZeroCampaignId");
  });

  it("rejects zero budget, zero maximum, and maximum above budget", async function () {
    const context = await loadFixture(deployFixture);
    const now = await time.latest();
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      CAMPAIGN_A, 0, 1, now, now + DAY, HOUR, true,
    )).to.be.revertedWithCustomError(context.reward, "InvalidCampaignBudget");
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      CAMPAIGN_A, 10, 0, now, now + DAY, HOUR, true,
    )).to.be.revertedWithCustomError(context.reward, "InvalidCampaignMaximum");
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      CAMPAIGN_A, 10, 11, now, now + DAY, HOUR, true,
    )).to.be.revertedWithCustomError(context.reward, "InvalidCampaignMaximum");
  });

  it("rejects malformed campaign times", async function () {
    const context = await loadFixture(deployFixture);
    const now = await time.latest();
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      CAMPAIGN_A, 10, 1, now + DAY, now, HOUR, true,
    )).to.be.revertedWithCustomError(context.reward, "InvalidCampaignTimeRange");
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      CAMPAIGN_A, 10, 1, now, now, HOUR, true,
    )).to.be.revertedWithCustomError(context.reward, "InvalidCampaignTimeRange");
  });

  it("rejects intervals below one hour and above seven days", async function () {
    const context = await loadFixture(deployFixture);
    const now = await time.latest();
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      CAMPAIGN_A, 10, 1, now, now + DAY, HOUR - 1, true,
    )).to.be.revertedWithCustomError(context.reward, "InvalidClaimInterval");
    await expect(context.reward.connect(context.campaignManager).createCampaign(
      CAMPAIGN_A, 10, 1, now, now + 8 * DAY, WEEK + 1, true,
    )).to.be.revertedWithCustomError(context.reward, "InvalidClaimInterval");
  });

  it("blocks inactive, not-started, and ended campaigns", async function () {
    const inactive = await loadFixture(deployFixture);
    await createCampaign(inactive, CAMPAIGN_A, { active: false });
    const inactiveClaim = await signedAuthorization(inactive);
    await expect(inactive.reward.connect(inactive.claimant).claimReward(inactiveClaim.authorization, inactiveClaim.signature))
      .to.be.revertedWithCustomError(inactive.reward, "CampaignInactive");

    const now = await time.latest();
    await inactive.reward.connect(inactive.campaignManager).setCampaignActive(CAMPAIGN_A, true);
    await inactive.reward.connect(inactive.campaignManager).setCampaignEndTime(CAMPAIGN_A, now + 3 * DAY);
    // A separate campaign can represent a future window deterministically.
    const futureId = ethers.id("future");
    await createCampaign(inactive, futureId, { startTime: now + DAY, endTime: now + 3 * DAY });
    const futureClaim = await signedAuthorization(inactive, { campaignId: futureId });
    await expect(inactive.reward.connect(inactive.claimant).claimReward(futureClaim.authorization, futureClaim.signature))
      .to.be.revertedWithCustomError(inactive.reward, "CampaignNotStarted");

    const endedId = ethers.id("ended");
    await createCampaign(inactive, endedId, { startTime: now - 2 * DAY, endTime: now - DAY });
    const endedClaim = await signedAuthorization(inactive, { campaignId: endedId });
    await expect(inactive.reward.connect(inactive.claimant).claimReward(endedClaim.authorization, endedClaim.signature))
      .to.be.revertedWithCustomError(inactive.reward, "CampaignEnded");
  });

  it("rejects an amount above the campaign maximum", async function () {
    const context = await loadFixture(campaignFixture);
    const claim = await signedAuthorization(context, { amount: DEFAULT_MAXIMUM + 1n });
    await expect(context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature))
      .to.be.revertedWithCustomError(context.reward, "RewardExceedsMaximum");
  });

  it("rejects claims that exceed remaining budget", async function () {
    const context = await loadFixture(deployFixture);
    await createCampaign(context, CAMPAIGN_A, { budget: 100n, maximum: 60n });
    const first = await signedAuthorization(context, { amount: 50n });
    await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    await time.increase(HOUR);
    const second = await signedAuthorization(context, { amount: 60n });
    await expect(context.reward.connect(context.claimant).claimReward(second.authorization, second.signature))
      .to.be.revertedWithCustomError(context.reward, "CampaignBudgetExceeded").withArgs(50, 60);
  });

  it("updates narrow settings and emits old and new values", async function () {
    const context = await loadFixture(campaignFixture);
    await expect(context.reward.connect(context.campaignManager).setCampaignActive(CAMPAIGN_A, false))
      .to.emit(context.reward, "CampaignActiveStatusUpdated").withArgs(CAMPAIGN_A, true, false);
    await expect(context.reward.connect(context.campaignManager).setCampaignClaimInterval(CAMPAIGN_A, DAY))
      .to.emit(context.reward, "CampaignIntervalUpdated").withArgs(CAMPAIGN_A, HOUR, DAY);
    await expect(context.reward.connect(context.campaignManager).setCampaignMaxRewardAmount(CAMPAIGN_A, 10n))
      .to.emit(context.reward, "CampaignMaxRewardUpdated").withArgs(CAMPAIGN_A, DEFAULT_MAXIMUM, 10n);
    await expect(context.reward.connect(context.campaignManager).setCampaignBudget(CAMPAIGN_A, DEFAULT_BUDGET + 1n))
      .to.emit(context.reward, "CampaignBudgetUpdated").withArgs(CAMPAIGN_A, DEFAULT_BUDGET, DEFAULT_BUDGET + 1n);
    const oldEnd = (await context.reward.getCampaign(CAMPAIGN_A)).endTime;
    await expect(context.reward.connect(context.campaignManager).setCampaignEndTime(CAMPAIGN_A, oldEnd + 1n))
      .to.emit(context.reward, "CampaignEndTimeUpdated").withArgs(CAMPAIGN_A, oldEnd, oldEnd + 1n);
  });

  it("does not allow budget below distributed or configured maximum", async function () {
    const context = await loadFixture(campaignFixture);
    const claim = await signedAuthorization(context, { amount: 50n });
    await context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature);
    await context.reward.connect(context.campaignManager).setCampaignMaxRewardAmount(CAMPAIGN_A, 40n);
    await expect(context.reward.connect(context.campaignManager).setCampaignBudget(CAMPAIGN_A, 49n))
      .to.be.revertedWithCustomError(context.reward, "BudgetBelowDistributed");
    await expect(context.reward.connect(context.campaignManager).setCampaignBudget(CAMPAIGN_A, 60n)).to.not.be.reverted;
    await context.reward.connect(context.campaignManager).setCampaignMaxRewardAmount(CAMPAIGN_A, 60n);
    await expect(context.reward.connect(context.campaignManager).setCampaignBudget(CAMPAIGN_A, 59n))
      .to.be.revertedWithCustomError(context.reward, "BudgetBelowMaximum");
  });

  it("rejects unsafe campaign-setting updates", async function () {
    const context = await loadFixture(campaignFixture);
    const campaign = await context.reward.getCampaign(CAMPAIGN_A);
    await expect(context.reward.connect(context.campaignManager).setCampaignClaimInterval(CAMPAIGN_A, HOUR - 1))
      .to.be.revertedWithCustomError(context.reward, "InvalidClaimInterval");
    await expect(context.reward.connect(context.campaignManager).setCampaignMaxRewardAmount(CAMPAIGN_A, 0))
      .to.be.revertedWithCustomError(context.reward, "InvalidCampaignMaximum");
    await expect(context.reward.connect(context.campaignManager).setCampaignBudget(CAMPAIGN_A, 0))
      .to.be.revertedWithCustomError(context.reward, "InvalidCampaignBudget");
    await expect(context.reward.connect(context.campaignManager).setCampaignEndTime(CAMPAIGN_A, campaign.startTime))
      .to.be.revertedWithCustomError(context.reward, "InvalidCampaignTimeRange");
  });

  it("rejects unauthorized campaign updates", async function () {
    const context = await loadFixture(campaignFixture);
    await expect(context.reward.connect(context.other).setCampaignClaimInterval(CAMPAIGN_A, DAY))
      .to.be.revertedWithCustomError(context.reward, "AccessControlUnauthorizedAccount");
  });
});
