import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { campaignFixture } from "./helpers";

describe("AurixRewardClaim: treasury recovery", function () {
  it("requires pause for configured reward-token withdrawal", async function () {
    const context = await loadFixture(campaignFixture);
    await expect(context.reward.connect(context.treasury).withdrawRewardToken(await context.other.getAddress(), 1))
      .to.be.revertedWithCustomError(context.reward, "ExpectedPause");
  });

  it("withdraws configured reward tokens only to a valid recipient", async function () {
    const context = await loadFixture(campaignFixture);
    const recipient = await context.other.getAddress();
    await context.reward.connect(context.pauser).pause();
    await expect(context.reward.connect(context.treasury).withdrawRewardToken(recipient, 123n))
      .to.emit(context.reward, "RewardTokenWithdrawn").withArgs(recipient, 123n);
    expect(await context.token.balanceOf(recipient)).to.equal(123n);
    await expect(context.reward.connect(context.treasury).withdrawRewardToken(ethers.ZeroAddress, 1))
      .to.be.revertedWithCustomError(context.reward, "ZeroAddress");
    await expect(context.reward.connect(context.treasury).withdrawRewardToken(recipient, 0))
      .to.be.revertedWithCustomError(context.reward, "ZeroAmount");
  });

  it("rejects configured-token withdrawal above balance", async function () {
    const context = await loadFixture(campaignFixture);
    await context.reward.connect(context.pauser).pause();
    const balance = await context.token.balanceOf(await context.reward.getAddress());
    await expect(context.reward.connect(context.treasury).withdrawRewardToken(
      await context.other.getAddress(), balance + 1n,
    )).to.be.revertedWithCustomError(context.reward, "InsufficientTokenBalance");
  });

  it("recovers an unrelated ERC-20 while paused", async function () {
    const context = await loadFixture(campaignFixture);
    const unrelated = await ethers.deployContract("TestERC20");
    await unrelated.mint(await context.reward.getAddress(), 500n);
    await context.reward.connect(context.pauser).pause();
    const recipient = await context.other.getAddress();
    await expect(context.reward.connect(context.treasury).recoverUnrelatedToken(unrelated, recipient, 500n))
      .to.emit(context.reward, "UnrelatedTokenRecovered")
      .withArgs(await unrelated.getAddress(), recipient, 500n);
    expect(await unrelated.balanceOf(recipient)).to.equal(500n);
  });

  it("does not allow configured reward token through unrelated recovery", async function () {
    const context = await loadFixture(campaignFixture);
    await context.reward.connect(context.pauser).pause();
    await expect(context.reward.connect(context.treasury).recoverUnrelatedToken(
      context.token, await context.other.getAddress(), 1,
    )).to.be.revertedWithCustomError(context.reward, "ConfiguredRewardTokenNotRecoverable");
  });
});
