import { ethers } from "hardhat";

import { parsePositiveInteger, requireAddressEnv, requireEnv } from "./lib/config";

async function main(): Promise<void> {
  const contract = await ethers.getContractAt("AurixRewardClaim", requireAddressEnv("REWARD_CONTRACT_ADDRESS"));
  const transaction = await contract.setCampaignClaimInterval(
    requireEnv("CAMPAIGN_ID"),
    parsePositiveInteger(requireEnv("CAMPAIGN_CLAIM_INTERVAL"), "CAMPAIGN_CLAIM_INTERVAL"),
  );
  console.log(`Interval transaction submitted: ${transaction.hash}`);
  await transaction.wait();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
