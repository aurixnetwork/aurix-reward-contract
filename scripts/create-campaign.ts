import { ethers } from "hardhat";

import { parsePositiveInteger, requireAddressEnv, requireEnv } from "./lib/config";

async function main(): Promise<void> {
  const contract = await ethers.getContractAt("AurixRewardClaim", requireAddressEnv("REWARD_CONTRACT_ADDRESS"));
  const campaignId = requireEnv("CAMPAIGN_ID");
  if (!/^0x[0-9a-fA-F]{64}$/.test(campaignId)) throw new Error("CAMPAIGN_ID must be bytes32 hex");
  const transaction = await contract.createCampaign(
    campaignId,
    parsePositiveInteger(requireEnv("CAMPAIGN_BUDGET"), "CAMPAIGN_BUDGET"),
    parsePositiveInteger(requireEnv("CAMPAIGN_MAX_REWARD"), "CAMPAIGN_MAX_REWARD"),
    parsePositiveInteger(requireEnv("CAMPAIGN_START_TIME"), "CAMPAIGN_START_TIME"),
    parsePositiveInteger(requireEnv("CAMPAIGN_END_TIME"), "CAMPAIGN_END_TIME"),
    parsePositiveInteger(requireEnv("CAMPAIGN_CLAIM_INTERVAL"), "CAMPAIGN_CLAIM_INTERVAL"),
    requireEnv("CAMPAIGN_ACTIVE").toLowerCase() === "true",
  );
  console.log(`Campaign transaction submitted: ${transaction.hash}`);
  await transaction.wait();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
