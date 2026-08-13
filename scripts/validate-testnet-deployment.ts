import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { artifacts, ethers } from "hardhat";

import {
  BSC_TESTNET_CHAIN_ID,
  BSC_TESTNET_DEPLOYER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES,
  formatErrorSafely,
  IRB_TEST_TOKEN_ADDRESS,
  requireEnv,
} from "./lib/config";

const CONTRACT_NAME = "AurixRewardClaim";
const EIP712_VERSION = "1";
const NETWORK_NAME = "BNB Smart Chain Testnet";
const FULLY_QUALIFIED_NAME = "contracts/AurixRewardClaim.sol:AurixRewardClaim";
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

const ERC20_METADATA_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
] as const;

const EXPECTED_CONSTRUCTOR_ARGUMENTS = [
  IRB_TEST_TOKEN_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_ADMIN_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_MANAGER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_CAMPAIGN_MANAGER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_PAUSER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_TREASURY_ADDRESS,
] as const;

const EXPECTED_ROLE_ASSIGNMENTS = {
  DEFAULT_ADMIN_ROLE: EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_ADMIN_ADDRESS,
  APPROVER_MANAGER_ROLE: EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_MANAGER_ADDRESS,
  APPROVER_ROLE: EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_ADDRESS,
  CAMPAIGN_MANAGER_ROLE: EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_CAMPAIGN_MANAGER_ADDRESS,
  PAUSER_ROLE: EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_PAUSER_ADDRESS,
  TREASURY_ROLE: EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_TREASURY_ADDRESS,
} as const;

type JsonObject = Record<string, unknown>;

interface DeploymentArtifact {
  network: string;
  chainId: string;
  deployedAtUtc: string;
  contractName: string;
  contractAddress: string;
  deploymentTransactionHash: string;
  blockNumber: number;
  confirmations: number;
  deployerAddress: string;
  constructorArguments: string[];
  eip712: { name: string; version: string };
  irbPreflight: {
    chainId: string;
    tokenAddress: string;
    codeSizeBytes: number;
    name: string;
    symbol: string;
    decimals: number;
  };
}

interface ImmutableReference {
  length: number;
  start: number;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(object: JsonObject, key: string): string {
  const value = object[key];
  assertCondition(typeof value === "string" && value.length > 0, `Deployment artifact ${key} must be a nonempty string`);
  return value;
}

function requireNumber(object: JsonObject, key: string): number {
  const value = object[key];
  assertCondition(typeof value === "number" && Number.isSafeInteger(value), `Deployment artifact ${key} must be a safe integer`);
  return value;
}

function assertExactAddress(actual: string, expected: string, label: string): void {
  assertCondition(ethers.isAddress(actual), `${label} is not a valid address`);
  assertCondition(ethers.getAddress(actual) === expected, `${label} must be exactly ${expected}`);
}

function scanArtifactForSecrets(value: unknown, jsonText: string): void {
  const forbiddenKeys: string[] = [];
  const forbiddenValues: string[] = [];
  const privateKeyLikeValues: string[] = [];

  function visit(item: unknown, currentPath: string): void {
    if (Array.isArray(item)) {
      item.forEach((entry, index) => visit(entry, `${currentPath}[${index}]`));
      return;
    }
    if (!isObject(item)) {
      if (typeof item === "string") {
        if (/(?:https?|wss?):\/\//iu.test(item)) forbiddenValues.push(currentPath);
        if (
          /^(?:0x)?[0-9a-fA-F]{64}$/u.test(item)
          && !/(?:transactionHash|Hash)$/u.test(currentPath)
        ) privateKeyLikeValues.push(currentPath);
      }
      return;
    }
    for (const [key, child] of Object.entries(item)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      if (/(?:private.?key|rpc.?url|api.?key|mnemonic|credential|secret)/iu.test(key)) forbiddenKeys.push(childPath);
      visit(child, childPath);
    }
  }

  visit(value, "");
  assertCondition(forbiddenKeys.length === 0, `Deployment artifact contains credential-like keys: ${forbiddenKeys.join(", ")}`);
  assertCondition(forbiddenValues.length === 0, `Deployment artifact contains URL values at: ${forbiddenValues.join(", ")}`);
  assertCondition(privateKeyLikeValues.length === 0, `Deployment artifact contains private-key-like values at: ${privateKeyLikeValues.join(", ")}`);

  for (const environmentName of ["BSC_TESTNET_RPC_URL", "DEPLOYER_PRIVATE_KEY", "ETHERSCAN_API_KEY"] as const) {
    const environmentValue = process.env[environmentName]?.trim();
    if (environmentValue) {
      assertCondition(!jsonText.includes(environmentValue), `Deployment artifact contains the configured ${environmentName} value`);
    }
  }
}

function parseDeploymentArtifact(parsed: unknown, jsonText: string): DeploymentArtifact {
  assertCondition(isObject(parsed), "Deployment artifact root must be a JSON object");
  scanArtifactForSecrets(parsed, jsonText);

  const network = requireString(parsed, "network");
  const chainId = requireString(parsed, "chainId");
  const deployedAtUtc = requireString(parsed, "deployedAtUtc");
  const contractName = requireString(parsed, "contractName");
  const contractAddress = requireString(parsed, "contractAddress");
  const deploymentTransactionHash = requireString(parsed, "deploymentTransactionHash");
  const blockNumber = requireNumber(parsed, "blockNumber");
  const confirmations = requireNumber(parsed, "confirmations");
  const deployerAddress = requireString(parsed, "deployerAddress");
  const constructorArguments = parsed.constructorArguments;
  const eip712 = parsed.eip712;
  const roleChecks = parsed.roleChecks;
  const approverSeparationChecks = parsed.approverSeparationChecks;
  const irbPreflight = parsed.irbPreflight;
  const compiler = parsed.compiler;
  const packageVersions = parsed.packageVersions;

  assertCondition(network === NETWORK_NAME, `Deployment artifact network must be ${NETWORK_NAME}`);
  assertCondition(chainId === BSC_TESTNET_CHAIN_ID.toString(), "Deployment artifact chainId must be 97");
  assertCondition(!Number.isNaN(Date.parse(deployedAtUtc)), "Deployment artifact deployedAtUtc is invalid");
  assertCondition(contractName === CONTRACT_NAME, `Deployment artifact contractName must be ${CONTRACT_NAME}`);
  assertCondition(ethers.isAddress(contractAddress), "Deployment artifact contractAddress is not a valid address");
  assertCondition(ethers.getAddress(contractAddress) === contractAddress, "Deployment artifact contractAddress must be checksummed");
  assertCondition(/^0x[0-9a-fA-F]{64}$/u.test(deploymentTransactionHash), "Deployment transaction hash is invalid");
  assertCondition(blockNumber > 0, "Deployment artifact blockNumber must be positive");
  assertCondition(confirmations > 0, "Deployment artifact confirmations must be positive");
  assertExactAddress(deployerAddress, BSC_TESTNET_DEPLOYER_ADDRESS, "Deployment artifact deployerAddress");

  assertCondition(Array.isArray(constructorArguments), "Deployment artifact constructorArguments must be an array");
  assertCondition(constructorArguments.length === EXPECTED_CONSTRUCTOR_ARGUMENTS.length, "Deployment artifact must contain seven constructor arguments");
  constructorArguments.forEach((argument, index) => {
    assertCondition(typeof argument === "string", `Constructor argument ${index} must be a string`);
    assertExactAddress(argument, EXPECTED_CONSTRUCTOR_ARGUMENTS[index], `Constructor argument ${index}`);
  });

  assertCondition(isObject(eip712), "Deployment artifact eip712 must be an object");
  assertCondition(eip712.name === CONTRACT_NAME, `Deployment artifact EIP-712 name must be ${CONTRACT_NAME}`);
  assertCondition(eip712.version === EIP712_VERSION, `Deployment artifact EIP-712 version must be ${EIP712_VERSION}`);

  assertCondition(isObject(roleChecks), "Deployment artifact roleChecks must be an object");
  for (const roleCheck of ["defaultAdmin", "approverManager", "approver", "campaignManager", "pauser", "treasury"] as const) {
    assertCondition(roleChecks[roleCheck] === true, `Deployment artifact roleChecks.${roleCheck} must be true`);
  }
  assertCondition(isObject(approverSeparationChecks), "Deployment artifact approverSeparationChecks must be an object");
  for (const roleCheck of ["defaultAdmin", "approverManager", "campaignManager", "pauser", "treasury"] as const) {
    assertCondition(
      approverSeparationChecks[roleCheck] === true,
      `Deployment artifact approverSeparationChecks.${roleCheck} must be true`,
    );
  }

  assertCondition(isObject(irbPreflight), "Deployment artifact irbPreflight must be an object");
  assertCondition(irbPreflight.chainId === BSC_TESTNET_CHAIN_ID.toString(), "Artifact IRB preflight chainId must be 97");
  assertCondition(typeof irbPreflight.tokenAddress === "string", "Artifact IRB tokenAddress must be a string");
  assertExactAddress(irbPreflight.tokenAddress, IRB_TEST_TOKEN_ADDRESS, "Artifact IRB tokenAddress");
  assertCondition(typeof irbPreflight.codeSizeBytes === "number" && irbPreflight.codeSizeBytes > 0, "Artifact IRB code size must be positive");
  assertCondition(irbPreflight.name === "IRISBANK", "Artifact IRB name must be IRISBANK");
  assertCondition(irbPreflight.symbol === "IRB", "Artifact IRB symbol must be IRB");
  assertCondition(irbPreflight.decimals === 18, "Artifact IRB decimals must be 18");
  assertCondition(typeof irbPreflight.checkedAtUtc === "string" && !Number.isNaN(Date.parse(irbPreflight.checkedAtUtc)), "Artifact IRB checkedAtUtc is invalid");
  assertCondition(typeof irbPreflight.totalSupplyBaseUnits === "string" && /^\d+$/u.test(irbPreflight.totalSupplyBaseUnits), "Artifact IRB total supply must be an unsigned integer string");

  assertCondition(isObject(compiler), "Deployment artifact compiler must be an object");
  assertCondition(compiler.version === "0.8.28", "Deployment artifact compiler version must be 0.8.28");
  assertCondition(compiler.optimizerRuns === 200, "Deployment artifact optimizer runs must be 200");
  assertCondition(compiler.evmVersion === "paris", "Deployment artifact EVM version must be paris");
  assertCondition(compiler.viaIR === false, "Deployment artifact viaIR must be false");
  assertCondition(isObject(packageVersions), "Deployment artifact packageVersions must be an object");
  for (const packageName of ["node", "hardhat", "ethers", "openzeppelinContracts", "dotenv", "typescript", "solidityCoverage", "solhint"] as const) {
    assertCondition(typeof packageVersions[packageName] === "string" && packageVersions[packageName].length > 0, `Deployment artifact packageVersions.${packageName} must be a nonempty string`);
  }
  assertCondition(typeof parsed.gitCommit === "string" && /^[0-9a-f]{40}$/u.test(parsed.gitCommit), "Deployment artifact gitCommit must be a full Git SHA-1");

  return {
    network,
    chainId,
    deployedAtUtc,
    contractName,
    contractAddress,
    deploymentTransactionHash,
    blockNumber,
    confirmations,
    deployerAddress,
    constructorArguments: constructorArguments as string[],
    eip712: eip712 as unknown as DeploymentArtifact["eip712"],
    irbPreflight: irbPreflight as unknown as DeploymentArtifact["irbPreflight"],
  };
}

async function resolveDeploymentArtifactPath(): Promise<string> {
  const configuredPath = process.env.DEPLOYMENT_ARTIFACT?.trim();
  if (configuredPath) return path.resolve(configuredPath);

  const filenames = (await readdir("deployments"))
    .filter((filename) => /^bsc-testnet-0x[0-9a-fA-F]{40}\.json$/u.test(filename))
    .sort();
  assertCondition(
    filenames.length === 1,
    "Set DEPLOYMENT_ARTIFACT when deployments/ does not contain exactly one address-specific BSC Testnet artifact",
  );
  return path.resolve("deployments", filenames[0]);
}

function normalizeBytecode(bytecode: string, immutableReferences: ImmutableReference[]): string {
  let normalized = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  assertCondition(/^[0-9a-fA-F]*$/u.test(normalized), "Bytecode is not hexadecimal");
  for (const reference of immutableReferences) {
    const start = reference.start * 2;
    const length = reference.length * 2;
    assertCondition(start + length <= normalized.length, "Immutable reference exceeds bytecode length");
    normalized = `${normalized.slice(0, start)}${"0".repeat(length)}${normalized.slice(start + length)}`;
  }
  return `0x${normalized.toLowerCase()}`;
}

async function getImmutableReferences(): Promise<ImmutableReference[]> {
  const buildInfo = await artifacts.getBuildInfo(FULLY_QUALIFIED_NAME);
  assertCondition(buildInfo !== undefined, "Hardhat build info for AurixRewardClaim is unavailable; run npm run compile first");
  const contractOutput = buildInfo.output.contracts["contracts/AurixRewardClaim.sol"]?.AurixRewardClaim;
  assertCondition(contractOutput !== undefined, "AurixRewardClaim compiler output is unavailable");
  const references = contractOutput.evm.deployedBytecode.immutableReferences;
  assertCondition(references !== undefined, "AurixRewardClaim immutable-reference metadata is unavailable");
  return Object.values(references).flat();
}

async function main(): Promise<void> {
  requireEnv("BSC_TESTNET_RPC_URL");
  const artifactPath = await resolveDeploymentArtifactPath();
  const artifactJson = await readFile(artifactPath, "utf8");
  const deployment = parseDeploymentArtifact(JSON.parse(artifactJson) as unknown, artifactJson);
  const artifactFilenameMatch = /^bsc-testnet-(0x[0-9a-fA-F]{40})\.json$/u.exec(path.basename(artifactPath));
  assertCondition(artifactFilenameMatch !== null, "Deployment artifact filename must contain its BSC Testnet contract address");
  assertCondition(
    ethers.getAddress(artifactFilenameMatch[1]) === deployment.contractAddress,
    "Deployment artifact filename address does not match contractAddress",
  );

  const network = await ethers.provider.getNetwork();
  assertCondition(network.chainId === BSC_TESTNET_CHAIN_ID, `Connected chain ID is ${network.chainId}; expected 97`);

  const validationBlockNumber = await ethers.provider.getBlockNumber();
  const [contractCode, tokenCode, transaction, receipt, deploymentBlock, deployerBalance] = await Promise.all([
    ethers.provider.getCode(deployment.contractAddress, validationBlockNumber),
    ethers.provider.getCode(IRB_TEST_TOKEN_ADDRESS, validationBlockNumber),
    ethers.provider.getTransaction(deployment.deploymentTransactionHash),
    ethers.provider.getTransactionReceipt(deployment.deploymentTransactionHash),
    ethers.provider.getBlock(deployment.blockNumber),
    ethers.provider.getBalance(deployment.deployerAddress, validationBlockNumber),
  ]);

  assertCondition(contractCode !== "0x", "No contract bytecode exists at the deployed address");
  assertCondition(tokenCode !== "0x", "No contract bytecode exists at the configured IRB address");
  assertCondition(transaction !== null, "Deployment transaction is unavailable through RPC");
  assertCondition(receipt !== null, "Deployment transaction receipt is unavailable through RPC");
  assertCondition(deploymentBlock !== null, "Deployment block is unavailable through RPC");
  assertCondition(transaction.to === null, "Recorded deployment transaction is not a contract creation transaction");
  assertCondition(receipt.status === 1, "Deployment transaction did not succeed");
  assertCondition(receipt.contractAddress !== null, "Deployment receipt does not contain a contract address");
  assertCondition(ethers.getAddress(receipt.contractAddress) === deployment.contractAddress, "Receipt contract address does not match artifact");
  assertCondition(receipt.blockNumber === deployment.blockNumber, "Receipt block number does not match artifact");
  assertCondition(ethers.getAddress(transaction.from) === deployment.deployerAddress, "Transaction deployer does not match artifact");
  assertCondition(transaction.blockNumber === deployment.blockNumber, "Transaction block number does not match artifact");

  const localArtifact = await artifacts.readArtifact(CONTRACT_NAME);
  const transactionData = transaction.data.toLowerCase();
  const creationBytecode = localArtifact.bytecode.toLowerCase();
  assertCondition(transactionData.startsWith(creationBytecode), "Deployment transaction initcode does not match the local compiled creation bytecode");
  const encodedConstructorArguments = `0x${transactionData.slice(creationBytecode.length)}`;
  assertCondition(
    encodedConstructorArguments.length === 2 + 64 * EXPECTED_CONSTRUCTOR_ARGUMENTS.length,
    "Deployment transaction constructor data length is unexpected",
  );
  const decodedConstructorArguments = ethers.AbiCoder.defaultAbiCoder().decode(
    Array(EXPECTED_CONSTRUCTOR_ARGUMENTS.length).fill("address"),
    encodedConstructorArguments,
  );
  decodedConstructorArguments.forEach((argument, index) => {
    assertCondition(typeof argument === "string", `Decoded constructor argument ${index} is not an address`);
    assertExactAddress(argument, EXPECTED_CONSTRUCTOR_ARGUMENTS[index], `On-chain constructor argument ${index}`);
  });

  const immutableReferences = await getImmutableReferences();
  const normalizedExpectedBytecode = normalizeBytecode(localArtifact.deployedBytecode, immutableReferences);
  const normalizedOnChainBytecode = normalizeBytecode(contractCode, immutableReferences);
  const normalizedBytecodeMatches = normalizedExpectedBytecode === normalizedOnChainBytecode;
  assertCondition(normalizedBytecodeMatches, "On-chain runtime bytecode does not match the locally compiled implementation after immutable normalization");

  const rewardContract = new ethers.Contract(deployment.contractAddress, localArtifact.abi, ethers.provider);
  const irbContract = new ethers.Contract(IRB_TEST_TOKEN_ADDRESS, ERC20_METADATA_ABI, ethers.provider);
  const [rewardToken, irbName, irbSymbol, irbDecimals, eip712Name, eip712Version, eip712Domain, paused] =
    await Promise.all([
      rewardContract.rewardToken(),
      irbContract.name() as Promise<string>,
      irbContract.symbol() as Promise<string>,
      irbContract.decimals() as Promise<bigint>,
      rewardContract.eip712Name(),
      rewardContract.eip712Version(),
      rewardContract.eip712Domain(),
      rewardContract.paused(),
    ]);

  assertExactAddress(rewardToken, IRB_TEST_TOKEN_ADDRESS, "On-chain rewardToken");
  assertCondition(irbName === "IRISBANK", "IRB name must be IRISBANK");
  assertCondition(irbSymbol === "IRB", "IRB symbol must be IRB");
  assertCondition(irbDecimals === 18n, "IRB decimals must be 18");
  assertCondition((tokenCode.length - 2) / 2 === deployment.irbPreflight.codeSizeBytes, "Current IRB bytecode size does not match the artifact preflight");
  assertCondition(eip712Name === CONTRACT_NAME, `EIP-712 name must be ${CONTRACT_NAME}`);
  assertCondition(eip712Version === EIP712_VERSION, `EIP-712 version must be ${EIP712_VERSION}`);
  assertCondition(eip712Domain.fields === "0x0f", "EIP-712 domain fields must bind name, version, chain ID, and verifying contract");
  assertCondition(eip712Domain.name === CONTRACT_NAME, `EIP-712 domain name must be ${CONTRACT_NAME}`);
  assertCondition(eip712Domain.version === EIP712_VERSION, `EIP-712 domain version must be ${EIP712_VERSION}`);
  assertCondition(eip712Domain.chainId === BSC_TESTNET_CHAIN_ID, "EIP-712 domain chain ID must be 97");
  assertExactAddress(eip712Domain.verifyingContract, deployment.contractAddress, "EIP-712 verifying contract");
  assertCondition(eip712Domain.salt === ethers.ZeroHash, "EIP-712 domain salt must be empty");
  assertCondition(eip712Domain.extensions.length === 0, "EIP-712 domain extensions must be empty");
  assertCondition(paused === false, "AurixRewardClaim must currently be unpaused");

  const roleIds = {
    DEFAULT_ADMIN_ROLE,
    APPROVER_MANAGER_ROLE: await rewardContract.APPROVER_MANAGER_ROLE(),
    APPROVER_ROLE: await rewardContract.APPROVER_ROLE(),
    CAMPAIGN_MANAGER_ROLE: await rewardContract.CAMPAIGN_MANAGER_ROLE(),
    PAUSER_ROLE: await rewardContract.PAUSER_ROLE(),
    TREASURY_ROLE: await rewardContract.TREASURY_ROLE(),
  } as const;
  const expectedRoleIds = {
    DEFAULT_ADMIN_ROLE,
    APPROVER_MANAGER_ROLE: ethers.id("APPROVER_MANAGER_ROLE"),
    APPROVER_ROLE: ethers.id("APPROVER_ROLE"),
    CAMPAIGN_MANAGER_ROLE: ethers.id("CAMPAIGN_MANAGER_ROLE"),
    PAUSER_ROLE: ethers.id("PAUSER_ROLE"),
    TREASURY_ROLE: ethers.id("TREASURY_ROLE"),
  } as const;
  for (const roleName of Object.keys(roleIds) as Array<keyof typeof roleIds>) {
    assertCondition(roleIds[roleName] === expectedRoleIds[roleName], `${roleName} identifier is unexpected`);
  }

  const positiveRoleChecks = await Promise.all(
    (Object.keys(EXPECTED_ROLE_ASSIGNMENTS) as Array<keyof typeof EXPECTED_ROLE_ASSIGNMENTS>).map(async (roleName) => ({
      role: roleName,
      roleId: roleIds[roleName],
      address: EXPECTED_ROLE_ASSIGNMENTS[roleName],
      hasRole: await rewardContract.hasRole(roleIds[roleName], EXPECTED_ROLE_ASSIGNMENTS[roleName]),
    })),
  );
  assertCondition(positiveRoleChecks.every((check) => check.hasRole), "One or more required positive role checks failed");

  const approverAddress = EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_ADDRESS;
  const operationsAddress = EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_CAMPAIGN_MANAGER_ADDRESS;
  const adminAddress = EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_ADMIN_ADDRESS;
  const negativeRoleRequests = [
    ...(["DEFAULT_ADMIN_ROLE", "APPROVER_MANAGER_ROLE", "CAMPAIGN_MANAGER_ROLE", "PAUSER_ROLE", "TREASURY_ROLE"] as const)
      .map((role) => ({ accountLabel: "Approver", address: approverAddress, role })),
    ...(["DEFAULT_ADMIN_ROLE", "APPROVER_MANAGER_ROLE", "APPROVER_ROLE", "TREASURY_ROLE"] as const)
      .map((role) => ({ accountLabel: "Operations", address: operationsAddress, role })),
    ...(["APPROVER_ROLE", "CAMPAIGN_MANAGER_ROLE", "PAUSER_ROLE"] as const)
      .map((role) => ({ accountLabel: "Admin/deployer", address: adminAddress, role })),
  ];
  const negativeRoleChecks = await Promise.all(
    negativeRoleRequests.map(async (request) => ({
      ...request,
      roleId: roleIds[request.role],
      hasRole: await rewardContract.hasRole(roleIds[request.role], request.address),
    })),
  );
  assertCondition(negativeRoleChecks.every((check) => !check.hasRole), "One or more negative role checks failed");

  const effectiveGasPrice = receipt.gasPrice;
  const deploymentFee = receipt.gasUsed * effectiveGasPrice;
  const report = {
    status: "passed",
    validationType: "read-only post-deployment",
    transactionsSent: 0,
    checkedAtUtc: new Date().toISOString(),
    validationBlockNumber,
    network: { name: NETWORK_NAME, chainId: network.chainId.toString() },
    artifact: {
      path: path.relative(process.cwd(), artifactPath),
      structureValid: true,
      containsSecrets: false,
      recordedDeployedAtUtc: deployment.deployedAtUtc,
    },
    deployment: {
      contractAddress: deployment.contractAddress,
      transactionHash: deployment.deploymentTransactionHash,
      blockNumber: receipt.blockNumber,
      blockTimestampUtc: new Date(deploymentBlock.timestamp * 1000).toISOString(),
      deployerAddress: deployment.deployerAddress,
      deployerBalanceWei: deployerBalance.toString(),
      deployerBalanceTbnb: ethers.formatEther(deployerBalance),
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPriceWei: effectiveGasPrice.toString(),
      effectiveGasPriceGwei: ethers.formatUnits(effectiveGasPrice, "gwei"),
      feeWei: deploymentFee.toString(),
      feeTbnb: ethers.formatEther(deploymentFee),
      constructorArguments: decodedConstructorArguments.map((argument) => String(argument)),
    },
    bytecode: {
      exists: true,
      sizeBytes: (contractCode.length - 2) / 2,
      expectedSizeBytes: (localArtifact.deployedBytecode.length - 2) / 2,
      exactMatch: contractCode.toLowerCase() === localArtifact.deployedBytecode.toLowerCase(),
      matchesExpectedImplementationIgnoringImmutableReferences: normalizedBytecodeMatches,
      immutableReferenceSlotsNormalized: immutableReferences.length,
      onChainCodeHash: ethers.keccak256(contractCode),
      normalizedOnChainCodeHash: ethers.keccak256(normalizedOnChainBytecode),
      normalizedExpectedCodeHash: ethers.keccak256(normalizedExpectedBytecode),
      deploymentInitcodeMatchesLocalCompilation: true,
    },
    rewardToken: {
      address: rewardToken,
      codeExists: true,
      codeSizeBytes: (tokenCode.length - 2) / 2,
      name: irbName,
      symbol: irbSymbol,
      decimals: Number(irbDecimals),
    },
    eip712: {
      fields: eip712Domain.fields,
      name: eip712Domain.name,
      version: eip712Domain.version,
      chainId: eip712Domain.chainId.toString(),
      verifyingContract: eip712Domain.verifyingContract,
      salt: eip712Domain.salt,
      extensions: eip712Domain.extensions.map((extension: bigint) => extension.toString()),
    },
    roles: { positiveChecks: positiveRoleChecks, negativeChecks: negativeRoleChecks },
    paused,
  };

  const outputPath = path.resolve("reports", `bsc-testnet-post-deployment-${deployment.contractAddress}.json`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...report, reportPath: path.relative(process.cwd(), outputPath) }, null, 2));
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
