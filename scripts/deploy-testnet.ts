import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { ethers } from "hardhat";

import { IRB_TEST_TOKEN_ADDRESS, requireAddressEnv } from "./lib/config";
import { validateIrbToken } from "./lib/irb-preflight";

interface PackageManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

async function main(): Promise<void> {
  const preflight = await validateIrbToken(ethers.provider, "reports/irb-testnet-preflight.json");
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("DEPLOYER_PRIVATE_KEY is required for deployment");

  const constructorArguments = [
    IRB_TEST_TOKEN_ADDRESS,
    requireAddressEnv("INITIAL_ADMIN_ADDRESS"),
    requireAddressEnv("INITIAL_APPROVER_MANAGER_ADDRESS"),
    requireAddressEnv("INITIAL_APPROVER_ADDRESS"),
    requireAddressEnv("INITIAL_CAMPAIGN_MANAGER_ADDRESS"),
    requireAddressEnv("INITIAL_PAUSER_ADDRESS"),
    requireAddressEnv("INITIAL_TREASURY_ADDRESS"),
  ] as const;

  const confirmationsText = process.env.DEPLOY_CONFIRMATIONS?.trim() || "3";
  if (!/^\d+$/.test(confirmationsText) || Number(confirmationsText) < 1) {
    throw new Error("DEPLOY_CONFIRMATIONS must be a positive integer");
  }
  const confirmations = Number(confirmationsText);

  const factory = await ethers.getContractFactory("AurixRewardClaim", deployer);
  const contract = await factory.deploy(...constructorArguments);
  const deploymentTransaction = contract.deploymentTransaction();
  if (!deploymentTransaction) throw new Error("Deployment transaction was not created");
  const receipt = await deploymentTransaction.wait(confirmations);
  if (!receipt) throw new Error("Deployment transaction receipt is unavailable");
  const contractAddress = await contract.getAddress();

  if ((await contract.rewardToken()) !== IRB_TEST_TOKEN_ADDRESS) {
    throw new Error("Deployed contract reward token verification failed");
  }
  if ((await contract.eip712Name()) !== "AurixRewardClaim" || (await contract.eip712Version()) !== "1") {
    throw new Error("Deployed contract EIP-712 domain verification failed");
  }

  const roleChecks = {
    defaultAdmin: await contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), constructorArguments[1]),
    approverManager: await contract.hasRole(await contract.APPROVER_MANAGER_ROLE(), constructorArguments[2]),
    approver: await contract.hasRole(await contract.APPROVER_ROLE(), constructorArguments[3]),
    campaignManager: await contract.hasRole(await contract.CAMPAIGN_MANAGER_ROLE(), constructorArguments[4]),
    pauser: await contract.hasRole(await contract.PAUSER_ROLE(), constructorArguments[5]),
    treasury: await contract.hasRole(await contract.TREASURY_ROLE(), constructorArguments[6]),
  };
  if (Object.values(roleChecks).some((assigned) => !assigned)) {
    throw new Error("One or more initial role assignments could not be verified");
  }

  const packageManifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest;
  const report = {
    network: "BNB Smart Chain Testnet",
    chainId: preflight.chainId,
    deployedAtUtc: new Date().toISOString(),
    contractName: "AurixRewardClaim",
    contractAddress,
    deploymentTransactionHash: deploymentTransaction.hash,
    blockNumber: receipt.blockNumber,
    confirmations,
    deployerAddress: await deployer.getAddress(),
    constructorArguments,
    eip712: { name: "AurixRewardClaim", version: "1" },
    roleChecks,
    irbPreflight: preflight,
    compiler: { version: "0.8.28", optimizerRuns: 200, evmVersion: "paris", viaIR: false },
    packageVersions: {
      node: process.version,
      hardhat: packageManifest.devDependencies.hardhat,
      ethers: packageManifest.devDependencies.ethers,
      openzeppelinContracts: packageManifest.dependencies["@openzeppelin/contracts"],
      dotenv: packageManifest.dependencies.dotenv,
      typescript: packageManifest.devDependencies.typescript,
      solidityCoverage: packageManifest.devDependencies["solidity-coverage"],
      solhint: packageManifest.devDependencies.solhint,
    },
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  };

  await mkdir("deployments", { recursive: true });
  const reportPath = `deployments/bsc-testnet-${contractAddress}.json`;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Deployment report written to ${reportPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
