import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { CAMPAIGN_A, CAMPAIGN_B, DAY, HOUR, WEEK, campaignFixture, createCampaign, signedAuthorization } from "./helpers";

describe("AurixRewardClaim: campaign intervals", function () {
  it("rejects a second claim before the interval", async function () {
    const context = await loadFixture(campaignFixture);
    const first = await signedAuthorization(context);
    await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    const second = await signedAuthorization(context);
    await expect(context.reward.connect(context.claimant).claimReward(second.authorization, second.signature))
      .to.be.revertedWithCustomError(context.reward, "ClaimIntervalNotElapsed");
  });

  it("allows the next claim at the exact interval boundary", async function () {
    const context = await loadFixture(campaignFixture);
    const first = await signedAuthorization(context);
    await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    const nextClaimAt = await context.reward.getNextClaimAt(CAMPAIGN_A, first.authorization.claimant);
    await time.setNextBlockTimestamp(nextClaimAt);
    const second = await signedAuthorization(context);
    await expect(context.reward.connect(context.claimant).claimReward(second.authorization, second.signature)).to.emit(
      context.reward, "RewardClaimed",
    );
  });

  it("allows repeated claims after one-hour and seven-day intervals", async function () {
    const context = await loadFixture(campaignFixture);
    await createCampaign(context, CAMPAIGN_B, { interval: WEEK });
    for (const campaignId of [CAMPAIGN_A, CAMPAIGN_B]) {
      const first = await signedAuthorization(context, { campaignId });
      await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    }
    await time.increase(WEEK);
    for (const campaignId of [CAMPAIGN_A, CAMPAIGN_B]) {
      const next = await signedAuthorization(context, { campaignId });
      await expect(context.reward.connect(context.claimant).claimReward(next.authorization, next.signature)).to.emit(
        context.reward, "RewardClaimed",
      );
    }
  });

  it("enforces independent intervals between campaigns", async function () {
    const context = await loadFixture(campaignFixture);
    await createCampaign(context, CAMPAIGN_B, { interval: DAY });
    for (const campaignId of [CAMPAIGN_A, CAMPAIGN_B]) {
      const claim = await signedAuthorization(context, { campaignId });
      await context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature);
    }
    await time.increase(HOUR);
    const hourly = await signedAuthorization(context, { campaignId: CAMPAIGN_A });
    await expect(context.reward.connect(context.claimant).claimReward(hourly.authorization, hourly.signature)).to.emit(
      context.reward, "RewardClaimed",
    );
    const daily = await signedAuthorization(context, { campaignId: CAMPAIGN_B });
    await expect(context.reward.connect(context.claimant).claimReward(daily.authorization, daily.signature))
      .to.be.revertedWithCustomError(context.reward, "ClaimIntervalNotElapsed");
  });

  it("applies a seven-day to one-hour reduction immediately to an existing claimant", async function () {
    const context = await loadFixture(campaignFixture);
    await context.reward.connect(context.campaignManager).setCampaignClaimInterval(CAMPAIGN_A, WEEK);
    const first = await signedAuthorization(context);
    await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    await time.increase(HOUR);
    await context.reward.connect(context.campaignManager).setCampaignClaimInterval(CAMPAIGN_A, HOUR);
    const second = await signedAuthorization(context);
    await expect(context.reward.connect(context.claimant).claimReward(second.authorization, second.signature)).to.emit(
      context.reward, "RewardClaimed",
    );
  });

  it("applies a one-hour to seven-day increase immediately to an existing claimant", async function () {
    const context = await loadFixture(campaignFixture);
    const first = await signedAuthorization(context);
    await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    await time.increase(HOUR);
    await context.reward.connect(context.campaignManager).setCampaignClaimInterval(CAMPAIGN_A, WEEK);
    expect(await context.reward.isClaimIntervalElapsed(CAMPAIGN_A, first.authorization.claimant)).to.be.false;
    const second = await signedAuthorization(context);
    await expect(context.reward.connect(context.claimant).claimReward(second.authorization, second.signature))
      .to.be.revertedWithCustomError(context.reward, "ClaimIntervalNotElapsed");
  });
});
