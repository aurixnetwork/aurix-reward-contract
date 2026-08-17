import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { artifacts, ethers, network } from "hardhat";

import { validateFrozenBaseline } from "./lib/baseline";
import {
  AURX_MAINNET_TOKEN_ADDRESS,
  BSC_MAINNET_CHAIN_ID,
  TESTNET_REWARD_CONTRACT_ADDRESS,
  formatErrorSafely,
  requireEnv,
  requireNetworkProfile,
} from "./lib/config";

interface DeploymentArtifact {
  chainId: string;
  contractName: string;
  contractAddress: string;
  deploymentTransactionHash: string;
  blockNumber: number;
  deployerAddress: string;
  constructorArguments: string[];
  eip712: { name: string; version: string; chainId: string; verifyingContract: string };
}

interface ImmutableReference { start: number; length: number }

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalizeBytecode(bytecode: string, references: ImmutableReference[]): string {
  let normalized = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  for (const reference of references) {
    const start = reference.start * 2;
    const length = reference.length * 2;
    normalized = `${normalized.slice(0, start)}${"0".repeat(length)}${normalized.slice(start + length)}`;
  }
  return `0x${normalized.toLowerCase()}`;
}

function scanForSecrets(text: string): void {
  for (const name of ["BSC_MAINNET_RPC_URL", "MAINNET_DEPLOYER_PRIVATE_KEY", "ETHERSCAN_API_KEY"] as const) {
    const value = process.env[name]?.trim();
    assertCondition(!value || !text.includes(value), `Deployment artifact contains ${name}`);
  }
  assertCondition(!/(private.?key|rpc.?url|api.?key|mnemonic|secret)/iu.test(text), "Deployment artifact contains a credential-like key");
}

async function main(): Promise<void> {
  requireNetworkProfile("MAINNET");
  requireEnv("BSC_MAINNET_RPC_URL");
  assertCondition(network.config.chainId === 56, "Validation network config must use chain ID 56");
  assertCondition((await ethers.provider.getNetwork()).chainId === BSC_MAINNET_CHAIN_ID, "RPC must report chain ID 56");
  const baseline = await validateFrozenBaseline(artifacts);

  const artifactPath = path.resolve(requireEnv("MAINNET_DEPLOYMENT_ARTIFACT"));
  const artifactText = await readFile(artifactPath, "utf8");
  scanForSecrets(artifactText);
  const deployment = JSON.parse(artifactText) as DeploymentArtifact;
  assertCondition(deployment.chainId === "56", "Deployment artifact chain ID must be 56");
  assertCondition(deployment.contractName === "AurixRewardClaim", "Deployment artifact contract name is invalid");
  assertCondition(ethers.isAddress(deployment.contractAddress), "Deployment artifact contract address is invalid");
  assertCondition(
    path.basename(artifactPath).toLowerCase() === `bsc-mainnet-${deployment.contractAddress}.json`.toLowerCase(),
    "Mainnet deployment artifact filename must contain its contract address",
  );
  assertCondition(ethers.getAddress(deployment.contractAddress) !== TESTNET_REWARD_CONTRACT_ADDRESS, "Testnet reward address cannot be used on Mainnet");
  assertCondition(/^0x[0-9a-fA-F]{64}$/u.test(deployment.deploymentTransactionHash), "Deployment transaction hash is invalid");
  assertCondition(Array.isArray(deployment.constructorArguments) && deployment.constructorArguments.length === 7, "Seven constructor arguments are required");
  assertCondition(ethers.getAddress(deployment.constructorArguments[0]) === AURX_MAINNET_TOKEN_ADDRESS, "Constructor token is not AURX Mainnet");
  assertCondition(deployment.eip712.name === "AurixRewardClaim" && deployment.eip712.version === "1", "Artifact EIP-712 identity is invalid");
  assertCondition(deployment.eip712.chainId === "56", "Artifact EIP-712 chain ID must be 56");
  assertCondition(ethers.getAddress(deployment.eip712.verifyingContract) === ethers.getAddress(deployment.contractAddress), "Artifact EIP-712 verifying contract is invalid");

  const [contractCode, tokenCode, transaction, receipt] = await Promise.all([
    ethers.provider.getCode(deployment.contractAddress),
    ethers.provider.getCode(AURX_MAINNET_TOKEN_ADDRESS),
    ethers.provider.getTransaction(deployment.deploymentTransactionHash),
    ethers.provider.getTransactionReceipt(deployment.deploymentTransactionHash),
  ]);
  assertCondition(contractCode !== "0x", "No bytecode exists at the Mainnet reward address");
  assertCondition(tokenCode !== "0x", "No bytecode exists at AURX Mainnet address");
  assertCondition(transaction !== null && transaction.to === null, "Deployment transaction is unavailable or not contract creation");
  assertCondition(receipt !== null && receipt.status === 1, "Deployment receipt is unavailable or unsuccessful");
  assertCondition(receipt.contractAddress !== null && ethers.getAddress(receipt.contractAddress) === ethers.getAddress(deployment.contractAddress), "Receipt contract address mismatch");
  assertCondition(receipt.blockNumber === deployment.blockNumber, "Deployment block mismatch");
  assertCondition(ethers.getAddress(transaction.from) === ethers.getAddress(deployment.deployerAddress), "Deployer mismatch");

  const buildInfo = await artifacts.getBuildInfo("contracts/AurixRewardClaim.sol:AurixRewardClaim");
  assertCondition(buildInfo !== undefined, "Build info is unavailable");
  const compiled = buildInfo.output.contracts["contracts/AurixRewardClaim.sol"].AurixRewardClaim;
  const localArtifact = await artifacts.readArtifact("AurixRewardClaim");
  assertCondition(
    transaction.data.toLowerCase().startsWith(localArtifact.bytecode.toLowerCase()),
    "Deployment initcode differs from frozen creation bytecode",
  );
  const encodedArguments = `0x${transaction.data.slice(localArtifact.bytecode.length)}`;
  const decodedArguments = ethers.AbiCoder.defaultAbiCoder().decode(Array(7).fill("address"), encodedArguments);
  decodedArguments.forEach((argument, index) => {
    assertCondition(
      typeof argument === "string"
        && ethers.getAddress(argument) === ethers.getAddress(deployment.constructorArguments[index]),
      `On-chain constructor argument ${index} differs from the deployment artifact`,
    );
  });
  const references = Object.values(compiled.evm.deployedBytecode.immutableReferences ?? {}).flat() as ImmutableReference[];
  assertCondition(
    normalizeBytecode(contractCode, references) === normalizeBytecode(`0x${compiled.evm.deployedBytecode.object}`, references),
    "Mainnet runtime bytecode differs from the frozen locally compiled baseline",
  );

  const contract = await ethers.getContractAt("AurixRewardClaim", deployment.contractAddress);
  const token = new ethers.Contract(AURX_MAINNET_TOKEN_ADDRESS, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ], ethers.provider);
  const [rewardToken, domain, tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
    contract.rewardToken(),
    contract.eip712Domain(),
    token.name() as Promise<string>,
    token.symbol() as Promise<string>,
    token.decimals() as Promise<bigint>,
  ]);
  assertCondition(rewardToken === AURX_MAINNET_TOKEN_ADDRESS, "On-chain rewardToken is not AURX Mainnet");
  assertCondition(tokenSymbol === "AURX" && tokenDecimals === 18n, "AURX metadata mismatch");
  assertCondition(domain.name === "AurixRewardClaim" && domain.version === "1", "On-chain EIP-712 identity mismatch");
  assertCondition(domain.chainId === 56n && domain.verifyingContract === deployment.contractAddress, "On-chain EIP-712 domain mismatch");

  const roleChecks = {
    defaultAdmin: await contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), deployment.constructorArguments[1]),
    approverManager: await contract.hasRole(await contract.APPROVER_MANAGER_ROLE(), deployment.constructorArguments[2]),
    approver: await contract.hasRole(await contract.APPROVER_ROLE(), deployment.constructorArguments[3]),
    campaignManager: await contract.hasRole(await contract.CAMPAIGN_MANAGER_ROLE(), deployment.constructorArguments[4]),
    pauser: await contract.hasRole(await contract.PAUSER_ROLE(), deployment.constructorArguments[5]),
    treasuryRecovery: await contract.hasRole(await contract.TREASURY_ROLE(), deployment.constructorArguments[6]),
  };
  assertCondition(Object.values(roleChecks).every(Boolean), "One or more Mainnet roles are missing");
  const approver = deployment.constructorArguments[3];
  const approverSeparated = await Promise.all([
    contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), approver),
    contract.hasRole(await contract.APPROVER_MANAGER_ROLE(), approver),
    contract.hasRole(await contract.CAMPAIGN_MANAGER_ROLE(), approver),
    contract.hasRole(await contract.PAUSER_ROLE(), approver),
    contract.hasRole(await contract.TREASURY_ROLE(), approver),
  ]);
  assertCondition(approverSeparated.every((assigned) => !assigned), "Mainnet Approver has an unintended role");

  const report = {
    status: "passed",
    checkedAtUtc: new Date().toISOString(),
    mode: "READ_ONLY",
    transactionsSent: 0,
    network: { name: "BNB Smart Chain Mainnet", chainId: "56" },
    contract: { address: deployment.contractAddress, runtimeBytecodeMatchesFrozenBaseline: true },
    rewardToken: { address: AURX_MAINNET_TOKEN_ADDRESS, name: tokenName, symbol: tokenSymbol, decimals: Number(tokenDecimals) },
    eip712: { name: domain.name, version: domain.version, chainId: domain.chainId.toString(), verifyingContract: domain.verifyingContract },
    roleChecks,
    approverSeparated: true,
    compiler: baseline.compiler,
  };
  const reportPath = `reports/bsc-mainnet-post-deployment-${deployment.contractAddress}.json`;
  await mkdir("reports", { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
