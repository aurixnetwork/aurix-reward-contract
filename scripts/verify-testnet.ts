import { readFile } from "node:fs/promises";

import { network, run } from "hardhat";

interface DeploymentReport {
  contractAddress: string;
  constructorArguments: string[];
  chainId: string;
}

async function main(): Promise<void> {
  if (network.config.chainId !== 97) throw new Error("Verification is restricted to BSC Testnet chain ID 97");
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
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
