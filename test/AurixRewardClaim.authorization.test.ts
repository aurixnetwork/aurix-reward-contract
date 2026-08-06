import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  CAMPAIGN_B,
  DAY,
  buildAuthorization,
  campaignFixture,
  signAuthorization,
  signedAuthorization,
} from "./helpers";

describe("AurixRewardClaim: EIP-712 authorization", function () {
  it("pays a valid self-claim and emits complete accounting", async function () {
    const context = await loadFixture(campaignFixture);
    const { authorization, signature } = await signedAuthorization(context);
    const before = await context.token.balanceOf(authorization.claimant);
    const transaction = await context.reward.connect(context.claimant).claimReward(authorization, signature);
    const receipt = await transaction.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    await expect(transaction).to.emit(context.reward, "RewardClaimed").withArgs(
      authorization.campaignId,
      authorization.rewardId,
      authorization.claimant,
      await context.approver.getAddress(),
      authorization.amount,
      0,
      block!.timestamp,
    );
    expect(await context.token.balanceOf(authorization.claimant)).to.equal(before + authorization.amount);
    expect((await context.reward.getCampaign(authorization.campaignId)).distributed).to.equal(authorization.amount);
    expect(await context.reward.getRewardNonce(authorization.campaignId, authorization.claimant)).to.equal(1);
    expect(await context.reward.getLastClaimAt(authorization.campaignId, authorization.claimant)).to.equal(block!.timestamp);
  });

  for (const [field, changed] of [
    ["claimant", async (context: Awaited<ReturnType<typeof campaignFixture>>) => await context.other.getAddress()],
    ["amount", async () => ethers.parseEther("11")],
    ["campaignId", async () => CAMPAIGN_B],
    ["rewardId", async () => ethers.id("modified-reward")],
    ["rewardNonce", async () => 1n],
    ["validAfter", async (context: Awaited<ReturnType<typeof campaignFixture>>) => (await buildAuthorization(context)).validAfter + 1n],
    ["deadline", async (context: Awaited<ReturnType<typeof campaignFixture>>) => (await buildAuthorization(context)).deadline + BigInt(DAY)],
  ] as const) {
    it(`rejects ${field} modification after signing`, async function () {
      const context = await loadFixture(campaignFixture);
      const original = await buildAuthorization(context);
      const signature = await signAuthorization(context, original);
      const modified = { ...original, [field]: await changed(context) };
      await expect(context.reward.connect(context.claimant).claimReward(modified, signature)).to.be.reverted;
    });
  }

  it("rejects a signer without the current Approver role", async function () {
    const context = await loadFixture(campaignFixture);
    const { authorization, signature } = await signedAuthorization(context, {}, context.fakeApprover);
    await expect(context.reward.connect(context.claimant).claimReward(authorization, signature))
      .to.be.revertedWithCustomError(context.reward, "InvalidApprover")
      .withArgs(await context.fakeApprover.getAddress());
  });

  it("rejects an authorization signed for another deployment", async function () {
    const context = await loadFixture(campaignFixture);
    const otherContract = await ethers.deployContract("AurixRewardClaim", [
      await context.token.getAddress(), await context.admin.getAddress(), await context.approverManager.getAddress(),
      await context.approver.getAddress(), await context.campaignManager.getAddress(), await context.pauser.getAddress(),
      await context.treasury.getAddress(),
    ]);
    const authorization = await buildAuthorization(context);
    const signature = await signAuthorization(context, authorization, context.approver, {
      verifyingContract: await otherContract.getAddress(),
    });
    await expect(context.reward.connect(context.claimant).claimReward(authorization, signature)).to.be.revertedWithCustomError(
      context.reward, "InvalidApprover",
    );
  });

  it("rejects an authorization signed for another chain domain", async function () {
    const context = await loadFixture(campaignFixture);
    const authorization = await buildAuthorization(context);
    const network = await ethers.provider.getNetwork();
    const signature = await signAuthorization(context, authorization, context.approver, { chainId: network.chainId + 1n });
    await expect(context.reward.connect(context.claimant).claimReward(authorization, signature)).to.be.revertedWithCustomError(
      context.reward, "InvalidApprover",
    );
  });

  it("prevents another wallet from using a valid authorization", async function () {
    const context = await loadFixture(campaignFixture);
    const { authorization, signature } = await signedAuthorization(context);
    await expect(context.reward.connect(context.other).claimReward(authorization, signature))
      .to.be.revertedWithCustomError(context.reward, "ClaimantMismatch")
      .withArgs(await context.other.getAddress(), await context.claimant.getAddress());
  });
});
