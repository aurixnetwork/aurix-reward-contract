import { artifacts, ethers } from "hardhat";

import {
  BSC_TESTNET_DEPLOYER_ADDRESS,
  formatErrorSafely,
  getTestnetConstructorArguments,
  getValidatedTestnetDeployer,
  requireEnv,
} from "./lib/config";
import { validateIrbToken } from "./lib/irb-preflight";

const DEPLOYMENT_GAS_MARGIN_PERCENT = 20n;
const EIP_170_DEPLOYED_BYTECODE_LIMIT = 24_576;
const EIP_3860_INITCODE_LIMIT = 49_152;

const CONSTRUCTOR_PARAMETER_NAMES = [
  "rewardTokenAddress",
  "initialAdmin",
  "initialApproverManager",
  "initialApprover",
  "initialCampaignManager",
  "initialPauser",
  "initialTreasury",
] as const;

async function main(): Promise<void> {
  requireEnv("BSC_TESTNET_RPC_URL");
  const preflight = await validateIrbToken(ethers.provider, "reports/irb-testnet-preflight.json");
  const constructorArguments = getTestnetConstructorArguments();
  const deployer = getValidatedTestnetDeployer(ethers.provider);
  const deployerBalance = await ethers.provider.getBalance(deployer.address);

  const factory = await ethers.getContractFactory("AurixRewardClaim", deployer);
  const unsignedDeployment = await factory.getDeployTransaction(...constructorArguments);
  if (typeof unsignedDeployment.data !== "string") {
    throw new Error("Deployment initcode could not be generated");
  }

  const estimatedDeploymentGas = await ethers.provider.estimateGas({
    data: unsignedDeployment.data,
    from: deployer.address,
  });
  const gasLimitWithMargin = estimatedDeploymentGas * (100n + DEPLOYMENT_GAS_MARGIN_PERCENT) / 100n;
  const feeData = await ethers.provider.getFeeData();
  const suggestedGasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
  if (suggestedGasPrice === null || suggestedGasPrice <= 0n) {
    throw new Error("RPC did not return a usable gas price");
  }
  const estimatedCost = estimatedDeploymentGas * suggestedGasPrice;
  const requiredWithMargin = gasLimitWithMargin * suggestedGasPrice;
  if (deployerBalance < requiredWithMargin) {
    throw new Error("Deployer tBNB balance is below the estimated deployment requirement plus 20% gas margin");
  }

  const artifact = await artifacts.readArtifact("AurixRewardClaim");
  const creationBytecodeBytes = (artifact.bytecode.length - 2) / 2;
  const deployedBytecodeBytes = (artifact.deployedBytecode.length - 2) / 2;
  const deploymentInitcodeBytes = (unsignedDeployment.data.length - 2) / 2;
  if (deployedBytecodeBytes > EIP_170_DEPLOYED_BYTECODE_LIMIT) {
    throw new Error("AurixRewardClaim deployed bytecode exceeds the EIP-170 limit");
  }
  if (deploymentInitcodeBytes > EIP_3860_INITCODE_LIMIT) {
    throw new Error("AurixRewardClaim deployment initcode exceeds the EIP-3860 limit");
  }

  const report = {
    status: "ready",
    transactionsSent: 0,
    network: "BNB Smart Chain Testnet",
    chainId: preflight.chainId,
    irbPreflight: preflight,
    deployer: {
      address: BSC_TESTNET_DEPLOYER_ADDRESS,
      balanceWei: deployerBalance.toString(),
      balanceTbnb: ethers.formatEther(deployerBalance),
    },
    constructor: CONSTRUCTOR_PARAMETER_NAMES.map((parameter, index) => ({
      parameter,
      value: constructorArguments[index],
    })),
    gas: {
      estimatedDeploymentGas: estimatedDeploymentGas.toString(),
      marginPercent: DEPLOYMENT_GAS_MARGIN_PERCENT.toString(),
      gasLimitWithMargin: gasLimitWithMargin.toString(),
      suggestedGasPriceWei: suggestedGasPrice.toString(),
      suggestedGasPriceGwei: ethers.formatUnits(suggestedGasPrice, "gwei"),
      estimatedCostWei: estimatedCost.toString(),
      estimatedCostTbnb: ethers.formatEther(estimatedCost),
      requiredWithMarginWei: requiredWithMargin.toString(),
      requiredWithMarginTbnb: ethers.formatEther(requiredWithMargin),
      balanceSufficient: true,
    },
    bytecode: {
      creationBytecodeBytes,
      deploymentInitcodeBytes,
      deployedBytecodeBytes,
      deployedBytecodeLimitBytes: EIP_170_DEPLOYED_BYTECODE_LIMIT,
      initcodeLimitBytes: EIP_3860_INITCODE_LIMIT,
    },
    plannedArtifactPath: "deployments/bsc-testnet-<deployed-contract-address>.json",
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
