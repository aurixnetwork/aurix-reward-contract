import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { CAMPAIGN_B, HOUR, buildAuthorization, campaignFixture, createCampaign, signAuthorization, signedAuthorization } from "./helpers";

describe("AurixRewardClaim: replay protection", function () {
  it("rejects the identical authorization and signature twice", async function () {
    const context = await loadFixture(campaignFixture);
    const { authorization, signature } = await signedAuthorization(context);
    await context.reward.connect(context.claimant).claimReward(authorization, signature);
    await expect(context.reward.connect(context.claimant).claimReward(authorization, signature))
      .to.be.revertedWithCustomError(context.reward, "RewardIdAlreadyUsed")
      .withArgs(authorization.rewardId);
  });

  it("rejects a reused rewardId with a new nonce and signature", async function () {
    const context = await loadFixture(campaignFixture);
    const first = await signedAuthorization(context);
    await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    await time.increase(HOUR);
    const second = await signedAuthorization(context, { rewardId: first.authorization.rewardId });
    await expect(context.reward.connect(context.claimant).claimReward(second.authorization, second.signature))
      .to.be.revertedWithCustomError(context.reward, "RewardIdAlreadyUsed");
  });

  it("rejects a previous campaign-and-wallet nonce", async function () {
    const context = await loadFixture(campaignFixture);
    const first = await signedAuthorization(context);
    await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    await time.increase(HOUR);
    const oldNonce = await buildAuthorization(context, { rewardNonce: 0n });
    const signature = await signAuthorization(context, oldNonce);
    await expect(context.reward.connect(context.claimant).claimReward(oldNonce, signature))
      .to.be.revertedWithCustomError(context.reward, "InvalidRewardNonce").withArgs(1, 0);
  });

  it("rejects a future campaign-and-wallet nonce", async function () {
    const context = await loadFixture(campaignFixture);
    const future = await signedAuthorization(context, { rewardNonce: 9n });
    await expect(context.reward.connect(context.claimant).claimReward(future.authorization, future.signature))
      .to.be.revertedWithCustomError(context.reward, "InvalidRewardNonce").withArgs(0, 9);
  });

  it("keeps rewardId global across campaigns", async function () {
    const context = await loadFixture(campaignFixture);
    await createCampaign(context, CAMPAIGN_B);
    const first = await signedAuthorization(context);
    await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    const second = await signedAuthorization(context, { campaignId: CAMPAIGN_B, rewardId: first.authorization.rewardId });
    await expect(context.reward.connect(context.claimant).claimReward(second.authorization, second.signature))
      .to.be.revertedWithCustomError(context.reward, "RewardIdAlreadyUsed");
  });

  it("maintains independent nonces for each campaign and claimant", async function () {
    const context = await loadFixture(campaignFixture);
    await createCampaign(context, CAMPAIGN_B);
    const first = await signedAuthorization(context);
    await context.reward.connect(context.claimant).claimReward(first.authorization, first.signature);
    expect(await context.reward.getRewardNonce(first.authorization.campaignId, first.authorization.claimant)).to.equal(1);
    expect(await context.reward.getRewardNonce(CAMPAIGN_B, first.authorization.claimant)).to.equal(0);
    expect(await context.reward.getRewardNonce(first.authorization.campaignId, await context.other.getAddress())).to.equal(0);
  });
});
