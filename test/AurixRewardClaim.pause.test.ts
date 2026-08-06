import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { campaignFixture, signedAuthorization } from "./helpers";

describe("AurixRewardClaim: pause controls", function () {
  it("lets PAUSER_ROLE pause and blocks claims", async function () {
    const context = await loadFixture(campaignFixture);
    const claim = await signedAuthorization(context);
    await expect(context.reward.connect(context.pauser).pause()).to.emit(context.reward, "Paused");
    await expect(context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature))
      .to.be.revertedWithCustomError(context.reward, "EnforcedPause");
  });

  it("rejects unauthorized pause and unpause", async function () {
    const context = await loadFixture(campaignFixture);
    await expect(context.reward.connect(context.other).pause())
      .to.be.revertedWithCustomError(context.reward, "AccessControlUnauthorizedAccount");
    await context.reward.connect(context.pauser).pause();
    await expect(context.reward.connect(context.pauser).unpause())
      .to.be.revertedWithCustomError(context.reward, "AccessControlUnauthorizedAccount");
  });

  it("lets only the default administrator unpause", async function () {
    const context = await loadFixture(campaignFixture);
    await context.reward.connect(context.pauser).pause();
    await expect(context.reward.connect(context.admin).unpause()).to.emit(context.reward, "Unpaused");
    expect(await context.reward.paused()).to.be.false;
  });
});
