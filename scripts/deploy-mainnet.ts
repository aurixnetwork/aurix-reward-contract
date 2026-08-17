import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { artifacts, ethers, network } from "hardhat";

import { validateFrozenBaseline } from "./lib/baseline";
import {
  AURX_MAINNET_TOKEN_ADDRESS,
  formatErrorSafely,
  getMainnetConstructorArguments,
  getValidatedMainnetDeployer,
  requireEnv,
  requireMainnetDeploymentGuard,
  requireNetworkProfile,
} from "./lib/config";
import { buildMainnetReadiness } from "./lib/mainnet-readiness";

const GAS_MARGIN_PERCENT = 20n;
const CONSTRUCTOR_PARAMETER_NAMES = [
  "rewardTokenAddress",
  "initialAdmin",
  "initialApproverManager",
  "initialApprover",
  "initialCampaignManager",
  "initialPauser",
  "initialTreasury",
] as const;

interface PackageManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

async function main(): Promise<void> {
  requireNetworkProfile("MAINNET");
  requireEnv("BSC_MAINNET_RPC_URL");
  requireMainnetDeploymentGuard();
  const baseline = await validateFrozenBaseline(artifacts);
  const readiness = await buildMainnetReadiness({
    provider: ethers.provider,
    environment: process.env,
    configuredChainId: network.config.chainId,
    compilerBaselineReady: baseline.ready,
  });
  if (!readiness.overallReady) {
    console.log(JSON.stringify(readiness, null, 2));
    throw new Error("Mainnet deployment readiness failed closed");
  }

  const constructorArguments = getMainnetConstructorArguments();
  const deployer = getValidatedMainnetDeployer(ethers.provider);
  const factory = await ethers.getContractFactory("AurixRewardClaim", deployer);
  const unsignedDeployment = await factory.getDeployTransaction(...constructorArguments);
  if (typeof unsignedDeployment.data !== "string") throw new Error("Deployment initcode could not be generated");
  const estimatedGas = await ethers.provider.estimateGas({ data: unsignedDeployment.data, from: deployer.address });
  const gasLimitWithMargin = estimatedGas * (100n + GAS_MARGIN_PERCENT) / 100n;
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
  if (gasPrice === null || gasPrice <= 0n) throw new Error("RPC did not return a usable Mainnet gas price");
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  if (deployerBalance < gasLimitWithMargin * gasPrice) {
    throw new Error("Mainnet deployer BNB balance is below the estimated cost plus 20% margin");
  }

  console.log(JSON.stringify({
    action: "AUTHORIZED_MAINNET_DEPLOYMENT",
    network: "BNB Smart Chain Mainnet",
    chainId: "56",
    deployer: deployer.address,
    deploymentGuardEnabled: true,
    constructor: CONSTRUCTOR_PARAMETER_NAMES.map((parameter, index) => ({ parameter, value: constructorArguments[index] })),
    estimatedGas: estimatedGas.toString(),
    gasLimitWithMargin: gasLimitWithMargin.toString(),
  }, null, 2));

  const confirmationsText = process.env.DEPLOY_CONFIRMATIONS?.trim() || "5";
  if (!/^\d+$/u.test(confirmationsText) || Number(confirmationsText) < 1) {
    throw new Error("DEPLOY_CONFIRMATIONS must be a positive integer");
  }
  const confirmations = Number(confirmationsText);
  const contract = await factory.deploy(...constructorArguments);
  const deploymentTransaction = contract.deploymentTransaction();
  if (!deploymentTransaction) throw new Error("Deployment transaction was not created");
  const receipt = await deploymentTransaction.wait(confirmations);
  if (!receipt) throw new Error("Deployment receipt is unavailable");
  const contractAddress = await contract.getAddress();

  if ((await contract.rewardToken()) !== AURX_MAINNET_TOKEN_ADDRESS) {
    throw new Error("Deployed Mainnet contract reward token verification failed");
  }
  if ((await contract.eip712Name()) !== "AurixRewardClaim" || (await contract.eip712Version()) !== "1") {
    throw new Error("Deployed Mainnet contract EIP-712 identity verification failed");
  }
  const domain = await contract.eip712Domain();
  if (domain.chainId !== 56n || domain.verifyingContract !== contractAddress) {
    throw new Error("Deployed Mainnet EIP-712 domain chain or verifying contract is incorrect");
  }

  const roleChecks = {
    defaultAdmin: await contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), constructorArguments[1]),
    approverManager: await contract.hasRole(await contract.APPROVER_MANAGER_ROLE(), constructorArguments[2]),
    approver: await contract.hasRole(await contract.APPROVER_ROLE(), constructorArguments[3]),
    campaignManager: await contract.hasRole(await contract.CAMPAIGN_MANAGER_ROLE(), constructorArguments[4]),
    pauser: await contract.hasRole(await contract.PAUSER_ROLE(), constructorArguments[5]),
    treasuryRecovery: await contract.hasRole(await contract.TREASURY_ROLE(), constructorArguments[6]),
  };
  if (Object.values(roleChecks).some((assigned) => !assigned)) {
    throw new Error("One or more Mainnet initial roles were not assigned as configured");
  }
  const approver = constructorArguments[3];
  const approverSeparation = {
    defaultAdmin: !(await contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), approver)),
    approverManager: !(await contract.hasRole(await contract.APPROVER_MANAGER_ROLE(), approver)),
    campaignManager: !(await contract.hasRole(await contract.CAMPAIGN_MANAGER_ROLE(), approver)),
    pauser: !(await contract.hasRole(await contract.PAUSER_ROLE(), approver)),
    treasuryRecovery: !(await contract.hasRole(await contract.TREASURY_ROLE(), approver)),
  };
  if (Object.values(approverSeparation).some((separated) => !separated)) {
    throw new Error("Mainnet Approver has an unintended operational role");
  }

  const packageManifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest;
  const report = {
    schemaVersion: 1,
    network: "BNB Smart Chain Mainnet",
    chainId: "56",
    deployedAtUtc: new Date().toISOString(),
    contractName: "AurixRewardClaim",
    contractAddress,
    deploymentTransactionHash: deploymentTransaction.hash,
    blockNumber: receipt.blockNumber,
    confirmations,
    deployerAddress: deployer.address,
    constructorArguments,
    eip712: { name: "AurixRewardClaim", version: "1", chainId: "56", verifyingContract: contractAddress },
    roleChecks,
    approverSeparation,
    rewardToken: readiness.rewardToken,
    compiler: baseline.compiler,
    packageVersions: {
      node: process.version,
      hardhat: packageManifest.devDependencies.hardhat,
      ethers: packageManifest.devDependencies.ethers,
      openzeppelinContracts: packageManifest.dependencies["@openzeppelin/contracts"],
      typescript: packageManifest.devDependencies.typescript,
    },
    sourceGitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    transactionsSent: 1,
    nextStep: "STOP_BEFORE_CAMPAIGN_CREATION",
  };
  await mkdir("deployments", { recursive: true });
  const reportPath = `deployments/bsc-mainnet-${contractAddress}.json`;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "deployed-and-validated", reportPath, contractAddress }, null, 2));
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
