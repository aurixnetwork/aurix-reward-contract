import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { CAMPAIGN_A, CAMPAIGN_B, CAMPAIGN_C, DAY, HOUR, WEEK, createCampaign, deployFixture } from "./helpers";

describe("AurixRewardClaim: deployment and public views", function () {
  it("deploys with the immutable token and EIP-712 identity", async function () {
    const { reward, token } = await loadFixture(deployFixture);
    expect(await reward.rewardToken()).to.equal(await token.getAddress());
    expect(await reward.eip712Name()).to.equal("AurixRewardClaim");
    expect(await reward.eip712Version()).to.equal("1");
    expect(await reward.MIN_CLAIM_INTERVAL()).to.equal(HOUR);
    expect(await reward.MAX_CLAIM_INTERVAL()).to.equal(WEEK);
  });

  it("assigns each initial role only to its explicit address", async function () {
    const context = await loadFixture(deployFixture);
    expect(await context.reward.hasRole(await context.reward.DEFAULT_ADMIN_ROLE(), await context.admin.getAddress())).to.be.true;
    expect(await context.reward.hasRole(await context.reward.APPROVER_MANAGER_ROLE(), await context.approverManager.getAddress())).to.be.true;
    expect(await context.reward.hasRole(await context.reward.APPROVER_ROLE(), await context.approver.getAddress())).to.be.true;
    expect(await context.reward.hasRole(await context.reward.CAMPAIGN_MANAGER_ROLE(), await context.campaignManager.getAddress())).to.be.true;
    expect(await context.reward.hasRole(await context.reward.PAUSER_ROLE(), await context.pauser.getAddress())).to.be.true;
    expect(await context.reward.hasRole(await context.reward.TREASURY_ROLE(), await context.treasury.getAddress())).to.be.true;
    expect(await context.reward.hasRole(await context.reward.DEFAULT_ADMIN_ROLE(), await context.deployer.getAddress())).to.be.false;
  });

  it("creates independent one-hour, one-day, and seven-day campaigns", async function () {
    const context = await loadFixture(deployFixture);
    await createCampaign(context, CAMPAIGN_A, { interval: HOUR });
    await createCampaign(context, CAMPAIGN_B, { interval: DAY });
    await createCampaign(context, CAMPAIGN_C, { interval: WEEK });
    expect((await context.reward.getCampaign(CAMPAIGN_A)).claimInterval).to.equal(HOUR);
    expect((await context.reward.getCampaign(CAMPAIGN_B)).claimInterval).to.equal(DAY);
    expect((await context.reward.getCampaign(CAMPAIGN_C)).claimInterval).to.equal(WEEK);
  });

  it("reports first-claim interval views consistently", async function () {
    const context = await loadFixture(deployFixture);
    await createCampaign(context);
    const claimant = await context.claimant.getAddress();
    expect(await context.reward.getRewardNonce(CAMPAIGN_A, claimant)).to.equal(0);
    expect(await context.reward.getLastClaimAt(CAMPAIGN_A, claimant)).to.equal(0);
    expect(await context.reward.getNextClaimAt(CAMPAIGN_A, claimant)).to.equal(0);
    expect(await context.reward.isClaimIntervalElapsed(CAMPAIGN_A, claimant)).to.be.true;
  });

  it("rejects every required zero-address constructor argument", async function () {
    const context = await loadFixture(deployFixture);
    const factory = await ethers.getContractFactory("AurixRewardClaim");
    const valid = [
      await context.token.getAddress(),
      await context.admin.getAddress(),
      await context.approverManager.getAddress(),
      await context.approver.getAddress(),
      await context.campaignManager.getAddress(),
      await context.pauser.getAddress(),
      await context.treasury.getAddress(),
    ];
    for (let index = 0; index < valid.length; index += 1) {
      const args = [...valid];
      args[index] = ethers.ZeroAddress;
      await expect(factory.deploy(...args)).to.be.revertedWithCustomError(context.reward, "ZeroAddress");
    }
  });

  it("uses a fixed authorization type hash", async function () {
    const context = await loadFixture(deployFixture);
    expect(await context.reward.REWARD_AUTHORIZATION_TYPEHASH()).to.equal(ethers.id(
      "RewardAuthorization(address claimant,uint256 amount,bytes32 campaignId,bytes32 rewardId,uint256 rewardNonce,uint256 validAfter,uint256 deadline)",
    ));
    expect(await time.latest()).to.be.greaterThan(0);
  });
});
