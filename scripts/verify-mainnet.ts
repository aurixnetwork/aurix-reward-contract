import { readFile } from "node:fs/promises";

import { ethers, network, run } from "hardhat";

import {
  AURX_MAINNET_TOKEN_ADDRESS,
  TESTNET_REWARD_CONTRACT_ADDRESS,
  formatErrorSafely,
  requireEnv,
  requireNetworkProfile,
} from "./lib/config";

interface DeploymentArtifact {
  chainId: string;
  contractAddress: string;
  constructorArguments: string[];
}

async function main(): Promise<void> {
  requireNetworkProfile("MAINNET");
  if (network.config.chainId !== 56 || (await ethers.provider.getNetwork()).chainId !== 56n) {
    throw new Error("Mainnet source verification is restricted to chain ID 56");
  }
  requireEnv("ETHERSCAN_API_KEY");
  const report = JSON.parse(await readFile(requireEnv("MAINNET_DEPLOYMENT_ARTIFACT"), "utf8")) as DeploymentArtifact;
  if (report.chainId !== "56") throw new Error("Deployment artifact is not for chain ID 56");
  if (
    ethers.getAddress(report.contractAddress) === TESTNET_REWARD_CONTRACT_ADDRESS
    && process.env.MAINNET_TESTNET_ADDRESS_REUSE_APPROVED?.trim() !== "true"
  ) {
    throw new Error("Testnet reward address cannot be verified as Mainnet without explicit owner reuse approval");
  }
  if (ethers.getAddress(report.constructorArguments[0]) !== AURX_MAINNET_TOKEN_ADDRESS) {
    throw new Error("Deployment artifact constructor does not use AURX Mainnet");
  }
  await run("verify:etherscan", {
    address: report.contractAddress,
    constructorArgsParams: report.constructorArguments,
    contract: "contracts/AurixRewardClaim.sol:AurixRewardClaim",
    force: false,
    libraries: {},
  });
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
