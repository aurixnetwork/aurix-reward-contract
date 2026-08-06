import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { CAMPAIGN_A, DAY, campaignFixture } from "./helpers";

describe("AurixRewardClaim: separated roles", function () {
  it("allows the Approver manager to add and revoke Approvers", async function () {
    const context = await loadFixture(campaignFixture);
    const role = await context.reward.APPROVER_ROLE();
    const candidate = await context.fakeApprover.getAddress();
    await context.reward.connect(context.approverManager).grantRole(role, candidate);
    expect(await context.reward.hasRole(role, candidate)).to.be.true;
    await context.reward.connect(context.approverManager).revokeRole(role, candidate);
    expect(await context.reward.hasRole(role, candidate)).to.be.false;
  });

  it("rejects unauthorized Approver management", async function () {
    const context = await loadFixture(campaignFixture);
    await expect(context.reward.connect(context.admin).grantRole(
      await context.reward.APPROVER_ROLE(), await context.other.getAddress(),
    )).to.be.revertedWithCustomError(context.reward, "AccessControlUnauthorizedAccount");
  });

  it("rejects a revoked Approver's otherwise valid signature", async function () {
    const context = await loadFixture(campaignFixture);
    const { signedAuthorization } = await import("./helpers");
    const claim = await signedAuthorization(context);
    await context.reward.connect(context.approverManager).revokeRole(
      await context.reward.APPROVER_ROLE(), await context.approver.getAddress(),
    );
    await expect(context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature))
      .to.be.revertedWithCustomError(context.reward, "InvalidApprover");
  });

  it("supports signer rotation without granting the new Approver other authority", async function () {
    const context = await loadFixture(campaignFixture);
    const role = await context.reward.APPROVER_ROLE();
    await context.reward.connect(context.approverManager).grantRole(role, await context.fakeApprover.getAddress());
    await context.reward.connect(context.approverManager).revokeRole(role, await context.approver.getAddress());
    const { signedAuthorization } = await import("./helpers");
    const claim = await signedAuthorization(context, {}, context.fakeApprover);
    await expect(context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature)).to.emit(
      context.reward, "RewardClaimed",
    );
    expect(await context.reward.hasRole(await context.reward.CAMPAIGN_MANAGER_ROLE(), await context.fakeApprover.getAddress())).to.be.false;
    expect(await context.reward.hasRole(await context.reward.TREASURY_ROLE(), await context.fakeApprover.getAddress())).to.be.false;
  });

  it("does not let an Approver manage campaigns", async function () {
    const context = await loadFixture(campaignFixture);
    await expect(context.reward.connect(context.approver).setCampaignClaimInterval(CAMPAIGN_A, DAY))
      .to.be.revertedWithCustomError(context.reward, "AccessControlUnauthorizedAccount");
  });

  it("does not let an Approver or campaign manager withdraw", async function () {
    const context = await loadFixture(campaignFixture);
    await context.reward.connect(context.pauser).pause();
    await expect(context.reward.connect(context.approver).withdrawRewardToken(await context.other.getAddress(), 1))
      .to.be.revertedWithCustomError(context.reward, "AccessControlUnauthorizedAccount");
    await expect(context.reward.connect(context.campaignManager).withdrawRewardToken(await context.other.getAddress(), 1))
      .to.be.revertedWithCustomError(context.reward, "AccessControlUnauthorizedAccount");
  });
});
