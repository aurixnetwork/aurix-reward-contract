import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { Signer, TypedDataField } from "ethers";

import type { AurixRewardClaim, TestERC20 } from "../typechain-types";

export const HOUR = 60 * 60;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;
export const CAMPAIGN_A = ethers.id("campaign-a");
export const CAMPAIGN_B = ethers.id("campaign-b");
export const CAMPAIGN_C = ethers.id("campaign-c");
export const DEFAULT_BUDGET = ethers.parseEther("10000");
export const DEFAULT_MAXIMUM = ethers.parseEther("100");

export interface RewardAuthorization {
  claimant: string;
  amount: bigint;
  campaignId: string;
  rewardId: string;
  rewardNonce: bigint;
  validAfter: bigint;
  deadline: bigint;
}

export const authorizationTypes: Record<string, TypedDataField[]> = {
  RewardAuthorization: [
    { name: "claimant", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "campaignId", type: "bytes32" },
    { name: "rewardId", type: "bytes32" },
    { name: "rewardNonce", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export interface TestContext {
  reward: AurixRewardClaim;
  token: TestERC20;
  deployer: Signer;
  admin: Signer;
  approverManager: Signer;
  approver: Signer;
  campaignManager: Signer;
  pauser: Signer;
  treasury: Signer;
  claimant: Signer;
  other: Signer;
  fakeApprover: Signer;
}

export async function deployFixture(): Promise<TestContext> {
  const [deployer, admin, approverManager, approver, campaignManager, pauser, treasury, claimant, other, fakeApprover] =
    await ethers.getSigners();
  const token = await ethers.deployContract("TestERC20") as unknown as TestERC20;
  const reward = await ethers.deployContract("AurixRewardClaim", [
    await token.getAddress(),
    await admin.getAddress(),
    await approverManager.getAddress(),
    await approver.getAddress(),
    await campaignManager.getAddress(),
    await pauser.getAddress(),
    await treasury.getAddress(),
  ]) as unknown as AurixRewardClaim;
  await token.mint(await reward.getAddress(), ethers.parseEther("1000000"));
  return {
    reward,
    token,
    deployer,
    admin,
    approverManager,
    approver,
    campaignManager,
    pauser,
    treasury,
    claimant,
    other,
    fakeApprover,
  };
}

export async function createCampaign(
  context: TestContext,
  campaignId = CAMPAIGN_A,
  overrides: Partial<{
    budget: bigint;
    maximum: bigint;
    startTime: number;
    endTime: number;
    interval: number;
    active: boolean;
  }> = {},
): Promise<void> {
  const now = await time.latest();
  await context.reward.connect(context.campaignManager).createCampaign(
    campaignId,
    overrides.budget ?? DEFAULT_BUDGET,
    overrides.maximum ?? DEFAULT_MAXIMUM,
    overrides.startTime ?? now - HOUR,
    overrides.endTime ?? now + 30 * DAY,
    overrides.interval ?? HOUR,
    overrides.active ?? true,
  );
}

export async function campaignFixture(): Promise<TestContext> {
  const context = await deployFixture();
  await createCampaign(context);
  return context;
}

export async function buildAuthorization(
  context: TestContext,
  overrides: Partial<RewardAuthorization> = {},
): Promise<RewardAuthorization> {
  const now = BigInt(await time.latest());
  const claimant = overrides.claimant ?? await context.claimant.getAddress();
  const campaignId = overrides.campaignId ?? CAMPAIGN_A;
  return {
    claimant,
    amount: overrides.amount ?? ethers.parseEther("10"),
    campaignId,
    rewardId: overrides.rewardId ?? ethers.hexlify(ethers.randomBytes(32)),
    rewardNonce: overrides.rewardNonce ?? await context.reward.getRewardNonce(campaignId, claimant),
    validAfter: overrides.validAfter ?? now,
    deadline: overrides.deadline ?? now + BigInt(DAY),
  };
}

export async function signAuthorization(
  context: TestContext,
  authorization: RewardAuthorization,
  signer: Signer = context.approver,
  domainOverrides: Partial<{ name: string; version: string; chainId: bigint; verifyingContract: string }> = {},
): Promise<string> {
  const network = await ethers.provider.getNetwork();
  return signer.signTypedData(
    {
      name: domainOverrides.name ?? "AurixRewardClaim",
      version: domainOverrides.version ?? "1",
      chainId: domainOverrides.chainId ?? network.chainId,
      verifyingContract: domainOverrides.verifyingContract ?? await context.reward.getAddress(),
    },
    authorizationTypes,
    authorization,
  );
}

export async function signedAuthorization(
  context: TestContext,
  overrides: Partial<RewardAuthorization> = {},
  signer: Signer = context.approver,
): Promise<{ authorization: RewardAuthorization; signature: string }> {
  const authorization = await buildAuthorization(context, overrides);
  return { authorization, signature: await signAuthorization(context, authorization, signer) };
}
