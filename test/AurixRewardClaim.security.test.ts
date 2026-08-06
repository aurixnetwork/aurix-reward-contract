import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { DAY, buildAuthorization, campaignFixture, signAuthorization, signedAuthorization } from "./helpers";

describe("AurixRewardClaim: security edge cases", function () {
  it("rejects authorization before validAfter", async function () {
    const context = await loadFixture(campaignFixture);
    const now = BigInt(await time.latest());
    const claim = await signedAuthorization(context, { validAfter: now + BigInt(DAY), deadline: now + 2n * BigInt(DAY) });
    await expect(context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature))
      .to.be.revertedWithCustomError(context.reward, "AuthorizationNotYetValid");
  });

  it("rejects authorization after deadline", async function () {
    const context = await loadFixture(campaignFixture);
    const authorization = await buildAuthorization(context);
    const signature = await signAuthorization(context, authorization);
    await time.increaseTo(authorization.deadline + 1n);
    await expect(context.reward.connect(context.claimant).claimReward(authorization, signature))
      .to.be.revertedWithCustomError(context.reward, "AuthorizationExpired");
  });

  it("rejects a deadline before validAfter", async function () {
    const context = await loadFixture(campaignFixture);
    const now = BigInt(await time.latest());
    const claim = await signedAuthorization(context, { validAfter: now + 100n, deadline: now + 99n });
    await expect(context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature))
      .to.be.revertedWithCustomError(context.reward, "InvalidAuthorizationWindow");
  });

  it("rejects zero claimant, amount, campaignId, and rewardId", async function () {
    const context = await loadFixture(campaignFixture);
    const zeroCases = [
      { overrides: { claimant: ethers.ZeroAddress }, error: "ZeroAddress", sender: context.claimant },
      { overrides: { amount: 0n }, error: "ZeroAmount", sender: context.claimant },
      { overrides: { campaignId: ethers.ZeroHash }, error: "ZeroCampaignId", sender: context.claimant },
      { overrides: { rewardId: ethers.ZeroHash }, error: "ZeroRewardId", sender: context.claimant },
    ] as const;
    for (const testCase of zeroCases) {
      const authorization = await buildAuthorization(context, testCase.overrides);
      const signature = await signAuthorization(context, authorization);
      await expect(context.reward.connect(testCase.sender).claimReward(authorization, signature))
        .to.be.revertedWithCustomError(context.reward, testCase.error);
    }
  });

  it("rejects an insufficient reward-token balance before effects", async function () {
    const context = await loadFixture(campaignFixture);
    const contractBalance = await context.token.balanceOf(await context.reward.getAddress());
    await context.reward.connect(context.pauser).pause();
    await context.reward.connect(context.treasury).withdrawRewardToken(await context.treasury.getAddress(), contractBalance);
    await context.reward.connect(context.admin).unpause();
    const claim = await signedAuthorization(context);
    await expect(context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature))
      .to.be.revertedWithCustomError(context.reward, "InsufficientRewardTokenBalance");
    expect(await context.reward.usedRewardIds(claim.authorization.rewardId)).to.be.false;
    expect(await context.reward.getRewardNonce(claim.authorization.campaignId, claim.authorization.claimant)).to.equal(0);
  });

  it("rolls back all effects when token transfer returns false", async function () {
    const context = await loadFixture(campaignFixture);
    const claim = await signedAuthorization(context);
    await context.token.setFailTransfers(true);
    await expect(context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature)).to.be.reverted;
    expect(await context.reward.usedRewardIds(claim.authorization.rewardId)).to.be.false;
    expect(await context.reward.getRewardNonce(claim.authorization.campaignId, claim.authorization.claimant)).to.equal(0);
    expect(await context.reward.getLastClaimAt(claim.authorization.campaignId, claim.authorization.claimant)).to.equal(0);
    expect((await context.reward.getCampaign(claim.authorization.campaignId)).distributed).to.equal(0);
  });

  it("rejects a token-triggered reentrant claim while completing the outer claim", async function () {
    const context = await loadFixture(campaignFixture);
    const claim = await signedAuthorization(context);
    const calldata = context.reward.interface.encodeFunctionData("claimReward", [claim.authorization, claim.signature]);
    await context.token.configureReentry(await context.reward.getAddress(), calldata);
    await expect(context.reward.connect(context.claimant).claimReward(claim.authorization, claim.signature)).to.emit(
      context.reward, "RewardClaimed",
    );
    expect(await context.token.reentryAttempted()).to.be.true;
    expect(await context.token.reentrySucceeded()).to.be.false;
  });

  it("rejects direct native BNB and unknown calls", async function () {
    const context = await loadFixture(campaignFixture);
    await expect(context.other.sendTransaction({ to: await context.reward.getAddress(), value: 1n }))
      .to.be.revertedWithCustomError(context.reward, "NativeTokenNotAccepted");
    await expect(context.other.sendTransaction({ to: await context.reward.getAddress(), data: "0x12345678" }))
      .to.be.revertedWithCustomError(context.reward, "NativeTokenNotAccepted");
  });
});
