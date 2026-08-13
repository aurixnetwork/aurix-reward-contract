import { readFile } from "node:fs/promises";

import { ethers, network, run } from "hardhat";

import { formatErrorSafely, requireEnv } from "./lib/config";

interface DeploymentReport {
  contractAddress: string;
  constructorArguments: string[];
  chainId: string;
}

async function main(): Promise<void> {
  if (network.config.chainId !== 97) throw new Error("Verification is restricted to BSC Testnet chain ID 97");
  if ((await ethers.provider.getNetwork()).chainId !== 97n) {
    throw new Error("Connected RPC is not BSC Testnet chain ID 97");
  }
  requireEnv("ETHERSCAN_API_KEY");
  const reportPath = process.env.DEPLOYMENT_FILE?.trim();
  if (!reportPath) throw new Error("DEPLOYMENT_FILE must point to a reviewed deployment JSON report");
  const report = JSON.parse(await readFile(reportPath, "utf8")) as DeploymentReport;
  if (report.chainId !== "97") throw new Error("Deployment report is not for chain ID 97");
  await run("verify:verify", {
    address: report.contractAddress,
    constructorArguments: report.constructorArguments,
    contract: "contracts/AurixRewardClaim.sol:AurixRewardClaim",
  });
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
