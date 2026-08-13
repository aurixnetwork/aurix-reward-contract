import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { artifacts, ethers } from "hardhat";

import {
  EXPECTED_INITIAL_ROLE_ADDRESSES,
  formatErrorSafely,
  IRB_TEST_TOKEN_ADDRESS,
} from "./lib/config";

const CONTRACT_NAME = "AurixRewardClaim";
const CONTRACT_FQN = "contracts/AurixRewardClaim.sol:AurixRewardClaim";
const DEPLOYMENT_ARTIFACT =
  "deployments/bsc-testnet-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json";
const OUTPUT_DIRECTORY = "verification/bscscan-testnet";
const EXPECTED_CONSTRUCTOR_ARGUMENTS = [
  IRB_TEST_TOKEN_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_ADMIN_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_MANAGER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_CAMPAIGN_MANAGER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_PAUSER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_TREASURY_ADDRESS,
] as const;

interface DeploymentArtifact {
  chainId: string;
  contractName: string;
  contractAddress: string;
  deploymentTransactionHash: string;
  constructorArguments: string[];
  compiler: {
    version: string;
    optimizerRuns: number;
    evmVersion: string;
    viaIR: boolean;
  };
  gitCommit: string;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function main(): Promise<void> {
  const deployment = JSON.parse(await readFile(DEPLOYMENT_ARTIFACT, "utf8")) as DeploymentArtifact;
  assertCondition(deployment.chainId === "97", "Deployment artifact chain ID must be 97");
  assertCondition(deployment.contractName === CONTRACT_NAME, "Deployment artifact contract name is unexpected");
  assertCondition(ethers.isAddress(deployment.contractAddress), "Deployment artifact contract address is invalid");
  assertCondition(/^0x[0-9a-f]{64}$/u.test(deployment.deploymentTransactionHash), "Deployment transaction hash is invalid");
  assertCondition(Array.isArray(deployment.constructorArguments) && deployment.constructorArguments.length === 7, "Deployment artifact must contain seven constructor arguments");
  deployment.constructorArguments.forEach((argument, index) => {
    assertCondition(ethers.getAddress(argument) === EXPECTED_CONSTRUCTOR_ARGUMENTS[index], `Constructor argument ${index} is unexpected`);
  });

  const buildInfo = await artifacts.getBuildInfo(CONTRACT_FQN);
  assertCondition(buildInfo !== undefined, "AurixRewardClaim build info is unavailable; run npm run compile first");
  assertCondition(buildInfo.solcVersion === deployment.compiler.version, "Build-info compiler version differs from deployment artifact");
  assertCondition(buildInfo.solcLongVersion === "0.8.28+commit.7893614a", "Build-info long compiler version is unexpected");
  assertCondition(buildInfo.input.settings.optimizer?.enabled === true, "Build-info optimizer must be enabled");
  assertCondition(buildInfo.input.settings.optimizer?.runs === deployment.compiler.optimizerRuns, "Build-info optimizer runs differ from deployment artifact");
  assertCondition(buildInfo.input.settings.evmVersion === deployment.compiler.evmVersion, "Build-info EVM version differs from deployment artifact");
  assertCondition(buildInfo.input.settings.viaIR === deployment.compiler.viaIR, "Build-info viaIR differs from deployment artifact");

  const contractOutput = buildInfo.output.contracts["contracts/AurixRewardClaim.sol"]?.AurixRewardClaim;
  assertCondition(contractOutput !== undefined, "AurixRewardClaim output is absent from build info");
  const localArtifact = await artifacts.readArtifact(CONTRACT_NAME);
  assertCondition(localArtifact.bytecode === `0x${contractOutput.evm.bytecode.object}`, "Artifact creation bytecode differs from build info");
  assertCondition(localArtifact.deployedBytecode === `0x${contractOutput.evm.deployedBytecode.object}`, "Artifact runtime bytecode differs from build info");

  const standardJsonInput = JSON.stringify(buildInfo.input);
  const metadata = (contractOutput as typeof contractOutput & { metadata?: string }).metadata;
  assertCondition(typeof metadata === "string", "AurixRewardClaim metadata is absent from build info");
  const encodedConstructorArguments = ethers.AbiCoder.defaultAbiCoder().encode(
    Array(deployment.constructorArguments.length).fill("address"),
    deployment.constructorArguments,
  );
  const encodedConstructorArgumentsWithoutPrefix = encodedConstructorArguments.slice(2);
  const packageManifest = {
    network: "BNB Smart Chain Testnet",
    chainId: deployment.chainId,
    contractName: CONTRACT_NAME,
    fullyQualifiedContractName: CONTRACT_FQN,
    contractAddress: deployment.contractAddress,
    deploymentTransactionHash: deployment.deploymentTransactionHash,
    deployedSourceGitCommit: deployment.gitCommit,
    compiler: {
      version: buildInfo.solcVersion,
      longVersion: buildInfo.solcLongVersion,
      bscscanVersion: `v${buildInfo.solcLongVersion}`,
      optimizerEnabled: buildInfo.input.settings.optimizer?.enabled,
      optimizerRuns: buildInfo.input.settings.optimizer?.runs,
      evmVersion: buildInfo.input.settings.evmVersion,
      viaIR: buildInfo.input.settings.viaIR,
    },
    license: "MIT",
    sourceCount: Object.keys(buildInfo.input.sources).length,
    standardJsonInputSha256: sha256(standardJsonInput),
    metadataSha256: sha256(metadata),
    encodedConstructorArguments,
    bscscanStatus: "not submitted",
    transactionsRequired: 0,
  };

  const readme = `# BscScan Testnet Standard JSON Verification Package

This package reproduces the exact Solidity compiler input used for the existing \`${CONTRACT_NAME}\` deployment. It contains public data only and has not been submitted to BscScan.

## BscScan form values

- Network: BNB Smart Chain Testnet (chain ID \`${deployment.chainId}\`)
- Deployed address: \`${deployment.contractAddress}\`
- Compiler type: Solidity (Standard-Json-Input)
- Compiler version: \`v${buildInfo.solcLongVersion}\`
- Open-source license: MIT
- Contract name/target: \`${CONTRACT_FQN}\`
- Standard JSON input: \`standard-json-input.json\`
- Constructor arguments (ABI encoded, without \`0x\`): copy the single line from \`constructor-arguments.txt\`

The Standard JSON input embeds optimizer enabled with 200 runs, Paris EVM, and \`viaIR: false\`. Do not change those settings, source paths, source contents, or the compilation target, and do not substitute a flattened contract.

The input SHA-256 is \`${sha256(standardJsonInput)}\`. The seven readable constructor values and both prefixed/unprefixed encodings are recorded in \`constructor-arguments.json\`.

Manual explorer source publication is an off-chain action and requires no blockchain transaction. Review all form fields and confirm the address is on BSC Testnet before submitting. Do not paste an RPC URL, private key, mnemonic, or API credential into the form or this directory.
`;

  const outputDirectory = path.resolve(OUTPUT_DIRECTORY);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, "standard-json-input.json"), standardJsonInput, "utf8"),
    writeFile(path.join(outputDirectory, "metadata.json"), metadata, "utf8"),
    writeFile(path.join(outputDirectory, "abi.json"), `${JSON.stringify(localArtifact.abi, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputDirectory, "constructor-arguments.txt"), `${encodedConstructorArgumentsWithoutPrefix}\n`, "utf8"),
    writeFile(
      path.join(outputDirectory, "constructor-arguments.json"),
      `${JSON.stringify({ values: deployment.constructorArguments, abiEncoded: encodedConstructorArguments, abiEncodedWithoutPrefix: encodedConstructorArgumentsWithoutPrefix }, null, 2)}\n`,
      "utf8",
    ),
    writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify(packageManifest, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputDirectory, "README.md"), readme, "utf8"),
  ]);

  console.log(JSON.stringify({ status: "prepared", outputDirectory: OUTPUT_DIRECTORY, ...packageManifest }, null, 2));
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
