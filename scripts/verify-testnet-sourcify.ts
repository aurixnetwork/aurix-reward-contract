import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import hre from "hardhat";

import {
  BSC_TESTNET_CHAIN_ID,
  BSC_TESTNET_DEPLOYER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES,
  formatErrorSafely,
  IRB_TEST_TOKEN_ADDRESS,
  requireEnv,
} from "./lib/config";

const CONTRACT_NAME = "AurixRewardClaim";
const CONTRACT_FQN = "contracts/AurixRewardClaim.sol:AurixRewardClaim";
const DEFAULT_DEPLOYMENT_ARTIFACT =
  "deployments/bsc-testnet-0x355D58c905f42F4f78abCD7413371F6EE4Dba137.json";
const EXPECTED_CONSTRUCTOR_ARGUMENTS = [
  IRB_TEST_TOKEN_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_ADMIN_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_MANAGER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_CAMPAIGN_MANAGER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_PAUSER_ADDRESS,
  EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_TREASURY_ADDRESS,
] as const;
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 90;

interface DeploymentArtifact {
  chainId: string;
  contractName: string;
  contractAddress: string;
  deploymentTransactionHash: string;
  deployerAddress: string;
  constructorArguments: string[];
  compiler: {
    version: string;
    optimizerRuns: number;
    evmVersion: string;
    viaIR: boolean;
  };
  gitCommit: string;
}

interface VerificationContract {
  match: "exact_match" | "match" | null;
  creationMatch: "exact_match" | "match" | null;
  runtimeMatch: "exact_match" | "match" | null;
  chainId: string;
  address: string;
  verifiedAt?: string;
  matchId?: string;
}

interface VerificationJob {
  isJobCompleted: boolean;
  verificationId: string;
  contract?: VerificationContract;
  error?: unknown;
  jobStartTime?: string;
  jobFinishTime?: string;
  compilationTime?: string;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(url, init);
  const responseText = await response.text();
  let body: unknown;
  try {
    body = responseText.length === 0 ? {} : JSON.parse(responseText);
  } catch {
    throw new Error(`Sourcify returned non-JSON HTTP ${response.status}`);
  }
  return { response, body };
}

function parseDeploymentArtifact(value: unknown): DeploymentArtifact {
  assertCondition(isObject(value), "Deployment artifact must be a JSON object");
  assertCondition(value.chainId === BSC_TESTNET_CHAIN_ID.toString(), "Deployment artifact chain ID must be 97");
  assertCondition(value.contractName === CONTRACT_NAME, `Deployment artifact contract name must be ${CONTRACT_NAME}`);
  assertCondition(typeof value.contractAddress === "string", "Deployment artifact contract address is missing");
  assertCondition(hre.ethers.isAddress(value.contractAddress), "Deployment artifact contract address is invalid");
  assertCondition(
    hre.ethers.getAddress(value.contractAddress) === value.contractAddress,
    "Deployment artifact contract address must be checksummed",
  );
  assertCondition(
    typeof value.deploymentTransactionHash === "string"
      && /^0x[0-9a-f]{64}$/u.test(value.deploymentTransactionHash),
    "Deployment transaction hash is invalid",
  );
  assertCondition(typeof value.deployerAddress === "string", "Deployment artifact deployer is missing");
  assertCondition(hre.ethers.getAddress(value.deployerAddress) === BSC_TESTNET_DEPLOYER_ADDRESS, "Deployment artifact deployer is unexpected");
  assertCondition(Array.isArray(value.constructorArguments), "Deployment artifact constructor arguments must be an array");
  assertCondition(value.constructorArguments.length === EXPECTED_CONSTRUCTOR_ARGUMENTS.length, "Deployment artifact must contain seven constructor arguments");
  value.constructorArguments.forEach((argument, index) => {
    assertCondition(typeof argument === "string", `Constructor argument ${index} must be a string`);
    assertCondition(hre.ethers.getAddress(argument) === EXPECTED_CONSTRUCTOR_ARGUMENTS[index], `Constructor argument ${index} is unexpected`);
  });
  assertCondition(isObject(value.compiler), "Deployment artifact compiler identity is missing");
  assertCondition(value.compiler.version === "0.8.28", "Deployment compiler version must be 0.8.28");
  assertCondition(value.compiler.optimizerRuns === 200, "Deployment optimizer runs must be 200");
  assertCondition(value.compiler.evmVersion === "paris", "Deployment EVM version must be paris");
  assertCondition(value.compiler.viaIR === false, "Deployment viaIR must be false");
  assertCondition(typeof value.gitCommit === "string" && /^[0-9a-f]{40}$/u.test(value.gitCommit), "Deployment source commit is invalid");
  return value as unknown as DeploymentArtifact;
}

function parsePublicContract(value: unknown): VerificationContract | null {
  assertCondition(isObject(value), "Sourcify contract lookup returned an invalid response");
  if (value.match === null) return null;
  assertCondition(value.match === "exact_match" || value.match === "match", "Sourcify returned an unknown match status");
  assertCondition(value.creationMatch === "exact_match" || value.creationMatch === "match", "Sourcify creation match is missing");
  assertCondition(value.runtimeMatch === "exact_match" || value.runtimeMatch === "match", "Sourcify runtime match is missing");
  assertCondition(typeof value.chainId === "string", "Sourcify result chain ID is missing");
  assertCondition(typeof value.address === "string", "Sourcify result address is missing");
  return value as unknown as VerificationContract;
}

async function lookupPublicContract(apiUrl: string, address: string): Promise<VerificationContract | null> {
  const url = `${apiUrl}/v2/contract/${BSC_TESTNET_CHAIN_ID}/${address}`;
  const { response, body } = await fetchJson(url);
  if (response.status === 404) return parsePublicContract(body);
  assertCondition(response.ok, `Sourcify lookup failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  return parsePublicContract(body);
}

async function getPublicRepositoryDetails(apiUrl: string, address: string): Promise<Record<string, unknown>> {
  const url = `${apiUrl}/v2/contract/${BSC_TESTNET_CHAIN_ID}/${address}?fields=all`;
  const { response, body } = await fetchJson(url);
  assertCondition(response.ok, `Sourcify public repository query failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  assertCondition(isObject(body), "Sourcify public repository returned an invalid response");
  return body;
}

async function main(): Promise<void> {
  requireEnv("BSC_TESTNET_RPC_URL");
  assertCondition(hre.network.config.chainId === Number(BSC_TESTNET_CHAIN_ID), "Verification network config must use chain ID 97");
  assertCondition("accounts" in hre.network.config && Array.isArray(hre.network.config.accounts) && hre.network.config.accounts.length === 0, "Sourcify verification must use a network with zero configured signer accounts");
  const connectedNetwork = await hre.ethers.provider.getNetwork();
  assertCondition(connectedNetwork.chainId === BSC_TESTNET_CHAIN_ID, "Connected RPC must be BSC Testnet chain ID 97");

  const deploymentPath = path.resolve(process.env.DEPLOYMENT_ARTIFACT?.trim() || DEFAULT_DEPLOYMENT_ARTIFACT);
  const deploymentText = await readFile(deploymentPath, "utf8");
  const deployment = parseDeploymentArtifact(JSON.parse(deploymentText) as unknown);

  const [code, transaction] = await Promise.all([
    hre.ethers.provider.getCode(deployment.contractAddress),
    hre.ethers.provider.getTransaction(deployment.deploymentTransactionHash),
  ]);
  assertCondition(code !== "0x", "No bytecode exists at the deployment address");
  assertCondition(transaction !== null && transaction.to === null, "Deployment transaction is unavailable or is not contract creation");
  assertCondition(hre.ethers.getAddress(transaction.from) === deployment.deployerAddress, "Deployment transaction sender is unexpected");

  const buildInfo = await hre.artifacts.getBuildInfo(CONTRACT_FQN);
  assertCondition(buildInfo !== undefined, "AurixRewardClaim build info is unavailable; run npm run compile first");
  assertCondition(buildInfo.solcVersion === deployment.compiler.version, "Build-info compiler version differs from deployment artifact");
  assertCondition(buildInfo.solcLongVersion === "0.8.28+commit.7893614a", "Build-info long compiler version is unexpected");
  assertCondition(buildInfo.input.settings.optimizer?.enabled === true, "Build-info optimizer must be enabled");
  assertCondition(buildInfo.input.settings.optimizer?.runs === deployment.compiler.optimizerRuns, "Build-info optimizer runs differ from deployment artifact");
  assertCondition(buildInfo.input.settings.evmVersion === deployment.compiler.evmVersion, "Build-info EVM version differs from deployment artifact");
  assertCondition(buildInfo.input.settings.viaIR === deployment.compiler.viaIR, "Build-info viaIR differs from deployment artifact");

  const contractOutput = buildInfo.output.contracts["contracts/AurixRewardClaim.sol"]?.AurixRewardClaim;
  assertCondition(contractOutput !== undefined, "AurixRewardClaim output is absent from build info");
  const localArtifact = await hre.artifacts.readArtifact(CONTRACT_NAME);
  assertCondition(localArtifact.bytecode === `0x${contractOutput.evm.bytecode.object}`, "Artifact creation bytecode differs from build info");
  assertCondition(localArtifact.deployedBytecode === `0x${contractOutput.evm.deployedBytecode.object}`, "Artifact runtime bytecode differs from build info");
  assertCondition(transaction.data.toLowerCase().startsWith(localArtifact.bytecode.toLowerCase()), "Deployment initcode differs from local compiled creation bytecode");

  const encodedArguments = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    Array(EXPECTED_CONSTRUCTOR_ARGUMENTS.length).fill("address"),
    deployment.constructorArguments,
  );
  const transactionArguments = `0x${transaction.data.slice(localArtifact.bytecode.length)}`;
  assertCondition(transactionArguments.toLowerCase() === encodedArguments.toLowerCase(), "Deployment constructor arguments differ from the reviewed artifact");

  const apiUrl = hre.config.sourcify.apiUrl?.replace(/\/$/u, "");
  const browserUrl = hre.config.sourcify.browserUrl?.replace(/\/$/u, "");
  assertCondition(hre.config.sourcify.enabled === true, "Sourcify must be enabled in Hardhat config");
  assertCondition(apiUrl !== undefined && browserUrl !== undefined, "Sourcify API and browser URLs must be configured");

  let publicContract = await lookupPublicContract(apiUrl, deployment.contractAddress);
  let verificationId: string | null = null;
  let verificationJob: VerificationJob | null = null;
  let submissionResult: "submitted" | "already_verified" = "already_verified";

  if (publicContract === null) {
    const request = {
      stdJsonInput: buildInfo.input,
      compilerVersion: buildInfo.solcLongVersion,
      contractIdentifier: CONTRACT_FQN,
      creationTransactionHash: deployment.deploymentTransactionHash,
    };
    const verifyUrl = `${apiUrl}/v2/verify/${BSC_TESTNET_CHAIN_ID}/${deployment.contractAddress}`;
    const { response, body } = await fetchJson(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.status === 409) {
      submissionResult = "already_verified";
    } else {
      assertCondition(response.status === 202, `Sourcify submission failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
      assertCondition(isObject(body) && typeof body.verificationId === "string", "Sourcify did not return a verification ID");
      verificationId = body.verificationId;
      submissionResult = "submitted";

      for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
        const { response: jobResponse, body: jobBody } = await fetchJson(`${apiUrl}/v2/verify/${verificationId}`);
        assertCondition(jobResponse.ok, `Sourcify job lookup failed with HTTP ${jobResponse.status}: ${JSON.stringify(jobBody)}`);
        assertCondition(isObject(jobBody) && typeof jobBody.isJobCompleted === "boolean", "Sourcify returned an invalid job response");
        verificationJob = jobBody as unknown as VerificationJob;
        if (verificationJob.isJobCompleted) break;
        if (attempt < MAX_POLL_ATTEMPTS) await sleep(POLL_INTERVAL_MS);
      }
      assertCondition(verificationJob?.isJobCompleted === true, "Sourcify verification did not complete before the polling limit");
      assertCondition(verificationJob.error === undefined, `Sourcify verification failed: ${JSON.stringify(verificationJob.error)}`);
    }
    publicContract = await lookupPublicContract(apiUrl, deployment.contractAddress);
  }

  assertCondition(publicContract !== null, "Sourcify did not publicly index the verified contract");
  assertCondition(publicContract.chainId === BSC_TESTNET_CHAIN_ID.toString(), "Sourcify indexed the contract on the wrong chain");
  assertCondition(hre.ethers.getAddress(publicContract.address) === deployment.contractAddress, "Sourcify indexed an unexpected address");
  assertCondition(publicContract.match === "exact_match", `Sourcify returned ${publicContract.match}; exact_match is required`);
  assertCondition(publicContract.creationMatch === "exact_match", "Sourcify creation bytecode is not an exact match");
  assertCondition(publicContract.runtimeMatch === "exact_match", "Sourcify runtime bytecode is not an exact match");

  const publicDetails = await getPublicRepositoryDetails(apiUrl, deployment.contractAddress);
  assertCondition(isObject(publicDetails.compilation), "Sourcify public compiler identity is missing");
  assertCondition(publicDetails.compilation.compiler === "solc", "Sourcify public compiler must be solc");
  assertCondition(publicDetails.compilation.compilerVersion === buildInfo.solcLongVersion, "Sourcify public compiler version is unexpected");
  assertCondition(publicDetails.compilation.name === CONTRACT_NAME, "Sourcify public contract name is unexpected");
  assertCondition(publicDetails.compilation.fullyQualifiedName === CONTRACT_FQN, "Sourcify public compilation target is unexpected");
  assertCondition(isObject(publicDetails.compilation.compilerSettings), "Sourcify public compiler settings are missing");
  assertCondition(publicDetails.compilation.compilerSettings.evmVersion === "paris", "Sourcify public EVM version is unexpected");
  assertCondition(publicDetails.compilation.compilerSettings.viaIR === false, "Sourcify public viaIR setting is unexpected");
  assertCondition(isObject(publicDetails.compilation.compilerSettings.optimizer), "Sourcify public optimizer settings are missing");
  assertCondition(publicDetails.compilation.compilerSettings.optimizer.enabled === true, "Sourcify public optimizer must be enabled");
  assertCondition(publicDetails.compilation.compilerSettings.optimizer.runs === 200, "Sourcify public optimizer runs must be 200");
  assertCondition(Array.isArray(publicDetails.abi), "Sourcify public ABI is missing");
  assertCondition(canonicalJson(publicDetails.abi) === canonicalJson(localArtifact.abi), "Sourcify public ABI differs from the local artifact");
  assertCondition(isObject(publicDetails.sources), "Sourcify public sources are missing");
  assertCondition(Object.keys(publicDetails.sources).length === Object.keys(buildInfo.input.sources).length, "Sourcify public source count is unexpected");
  const publicPrimarySource = publicDetails.sources["contracts/AurixRewardClaim.sol"];
  assertCondition(isObject(publicPrimarySource) && typeof publicPrimarySource.content === "string", "Sourcify public AurixRewardClaim source is missing");
  assertCondition(
    publicPrimarySource.content === buildInfo.input.sources["contracts/AurixRewardClaim.sol"].content,
    "Sourcify public AurixRewardClaim source differs from build info",
  );
  assertCondition(isObject(publicDetails.deployment), "Sourcify public deployment data is missing");
  assertCondition(publicDetails.deployment.transactionHash === deployment.deploymentTransactionHash, "Sourcify public deployment transaction is unexpected");

  const checkedAtUtc = new Date().toISOString();
  const publicUrl = `${browserUrl}/${BSC_TESTNET_CHAIN_ID}/${deployment.contractAddress}`;
  const standardJsonText = JSON.stringify(buildInfo.input);
  const report = {
    status: "passed",
    verificationService: "Sourcify API v2",
    transactionsSent: 0,
    checkedAtUtc,
    network: { name: "BNB Smart Chain Testnet", chainId: BSC_TESTNET_CHAIN_ID.toString() },
    contract: { name: CONTRACT_NAME, fullyQualifiedName: CONTRACT_FQN, address: deployment.contractAddress },
    deploymentTransactionHash: deployment.deploymentTransactionHash,
    deployedSourceGitCommit: deployment.gitCommit,
    compiler: {
      version: buildInfo.solcVersion,
      longVersion: buildInfo.solcLongVersion,
      optimizer: buildInfo.input.settings.optimizer,
      evmVersion: buildInfo.input.settings.evmVersion,
      viaIR: buildInfo.input.settings.viaIR,
      standardJsonInputSha256: sha256(standardJsonText),
      sourceCount: Object.keys(buildInfo.input.sources).length,
    },
    constructorArguments: deployment.constructorArguments,
    encodedConstructorArguments: encodedArguments,
    submission: { result: submissionResult, verificationId },
    verificationJob,
    publicResult: publicContract,
    publicRepositoryEvidence: {
      compiler: publicDetails.compilation,
      sourceCount: Object.keys(publicDetails.sources).length,
      primarySourcePresentAndMatched: true,
      abiEntries: publicDetails.abi.length,
      abiMatchesLocalArtifact: true,
      deployment: publicDetails.deployment,
      responseSha256: sha256(JSON.stringify(publicDetails)),
    },
    publicUrl,
  };
  const reportPath = path.resolve(
    "reports",
    `bsc-testnet-source-verification-${deployment.contractAddress}.json`,
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...report, reportPath: path.relative(process.cwd(), reportPath) }, null, 2));
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
