import { artifacts, ethers, network } from "hardhat";

import { validateFrozenBaseline } from "./lib/baseline";
import { formatErrorSafely, requireEnv } from "./lib/config";
import { buildMainnetReadiness } from "./lib/mainnet-readiness";

async function main(): Promise<void> {
  requireEnv("BSC_MAINNET_RPC_URL");
  let compilerBaselineReady = false;
  try {
    await validateFrozenBaseline(artifacts);
    compilerBaselineReady = true;
  } catch {
    compilerBaselineReady = false;
  }
  const report = await buildMainnetReadiness({
    provider: ethers.provider,
    environment: process.env,
    configuredChainId: network.config.chainId,
    compilerBaselineReady,
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.overallReady) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
