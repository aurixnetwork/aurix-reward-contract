import { ethers } from "hardhat";

import { validateIrbToken } from "./lib/irb-preflight";

async function main(): Promise<void> {
  if (!process.env.BSC_TESTNET_RPC_URL?.trim()) {
    throw new Error("BSC_TESTNET_RPC_URL is required");
  }
  const report = await validateIrbToken(ethers.provider, "reports/irb-testnet-preflight.json");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
