import { Interface, ZeroAddress, formatEther, formatUnits, getAddress, isAddress } from "ethers";

import {
  AURX_MAINNET_TOKEN_ADDRESS,
  BSC_MAINNET_CHAIN_ID,
  EXPECTED_INITIAL_ROLE_ADDRESSES,
  IRB_TEST_TOKEN_ADDRESS,
  MAINNET_ROLE_ENVIRONMENT_NAMES,
  TESTNET_REWARD_CONTRACT_ADDRESS,
  assertProfileConnection,
  type Environment,
  type MainnetRoleName,
} from "./config";

const TOKEN_INTERFACE = new Interface([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

const TESTNET_ADDRESSES = new Set<string>([
  IRB_TEST_TOKEN_ADDRESS,
  TESTNET_REWARD_CONTRACT_ADDRESS,
  ...Object.values(EXPECTED_INITIAL_ROLE_ADDRESSES),
].map((address) => address.toLowerCase()));

export interface ReadOnlyProvider {
  getNetwork(): Promise<{ chainId: bigint }>;
  getCode(address: string): Promise<string>;
  call(transaction: { to: string; data: string }): Promise<string>;
  getBalance(address: string): Promise<bigint>;
  getFeeData(): Promise<{ gasPrice?: bigint | null; maxFeePerGas?: bigint | null }>;
}

export interface MainnetReadinessOptions {
  provider: ReadOnlyProvider;
  environment?: Environment;
  configuredChainId?: number;
  compilerBaselineReady: boolean;
}

export type AddressReadinessValue = string | "REQUIRED_OWNER_INPUT" | "INVALID";

export interface MainnetReadinessReport {
  mode: "READ_ONLY";
  transactionsSent: 0;
  network: {
    profile: string;
    expectedChainId: number;
    configuredChainId: number | null;
    actualChainId: number;
    ready: boolean;
  };
  rewardToken: {
    symbol: string | null;
    name: string | null;
    expectedAddress: string;
    configuredAddress: string | null;
    codeExists: boolean;
    codeSizeBytes: number;
    decimals: number | null;
    ready: boolean;
  };
  roles: Record<MainnetRoleName, AddressReadinessValue> & { ready: boolean };
  deployer: {
    address: AddressReadinessValue;
    balanceWei: string | null;
    balanceBnb: string | null;
    ready: boolean;
  };
  compiler: { ready: boolean; version: "0.8.28"; optimizerRuns: 200; evmVersion: "paris"; viaIR: false };
  eip712: { name: "AurixRewardClaim"; version: "1"; chainId: 56; verifyingContract: "FUTURE_MAINNET_REWARD_CONTRACT" };
  constructorArguments: Array<{ parameter: string; value: string }>;
  deployment: {
    deployed: boolean;
    configuredAddress: string | null;
    deploymentGuardEnabled: boolean;
    suggestedGasPriceWei: string | null;
    suggestedGasPriceGwei: string | null;
    artifactPattern: "deployments/bsc-mainnet-<contract-address>.json";
    ready: boolean;
  };
  issues: string[];
  overallReady: boolean;
}

function parseConfiguredAddress(
  name: string,
  environment: Environment,
  issues: string[],
  options: { rejectTestnetReuse?: boolean } = {},
): AddressReadinessValue {
  const raw = environment[name]?.trim();
  if (!raw) {
    issues.push(`${name}: REQUIRED_OWNER_INPUT`);
    return "REQUIRED_OWNER_INPUT";
  }
  if (!isAddress(raw) || getAddress(raw) === ZeroAddress) {
    issues.push(`${name}: invalid or zero EVM address`);
    return "INVALID";
  }
  const address = getAddress(raw);
  if (
    options.rejectTestnetReuse
    && TESTNET_ADDRESSES.has(address.toLowerCase())
    && environment.MAINNET_TESTNET_ADDRESS_REUSE_APPROVED?.trim() !== "true"
  ) {
    issues.push(`${name}: matches a Testnet address without explicit owner reuse approval`);
    return "INVALID";
  }
  return address;
}

async function readString(provider: ReadOnlyProvider, address: string, functionName: "name" | "symbol"): Promise<string> {
  const data = TOKEN_INTERFACE.encodeFunctionData(functionName);
  const result = await provider.call({ to: address, data });
  return TOKEN_INTERFACE.decodeFunctionResult(functionName, result)[0] as string;
}

async function readDecimals(provider: ReadOnlyProvider, address: string): Promise<number> {
  const data = TOKEN_INTERFACE.encodeFunctionData("decimals");
  const result = await provider.call({ to: address, data });
  return Number(TOKEN_INTERFACE.decodeFunctionResult("decimals", result)[0] as bigint);
}

export async function buildMainnetReadiness(options: MainnetReadinessOptions): Promise<MainnetReadinessReport> {
  const environment = options.environment ?? process.env;
  const issues: string[] = [];
  const selectedProfile = environment.AURIX_NETWORK_PROFILE?.trim().toUpperCase() || "REQUIRED_OWNER_INPUT";
  if (selectedProfile !== "MAINNET") issues.push("AURIX_NETWORK_PROFILE must be exactly MAINNET");

  const actualChainId = Number((await options.provider.getNetwork()).chainId);
  const configuredChainId = options.configuredChainId ?? null;
  let connectionReady = false;
  try {
    if (configuredChainId !== null) assertProfileConnection("MAINNET", configuredChainId, BigInt(actualChainId));
    connectionReady = configuredChainId !== null;
  } catch {
    connectionReady = false;
  }
  const networkReady = selectedProfile === "MAINNET" && connectionReady;
  if (configuredChainId !== Number(BSC_MAINNET_CHAIN_ID)) issues.push("Hardhat network must be configured for chain ID 56");
  if (actualChainId !== Number(BSC_MAINNET_CHAIN_ID)) issues.push(`RPC chain ID ${actualChainId} does not match Mainnet chain ID 56`);

  const rawTokenAddress = environment.AURX_TOKEN_ADDRESS?.trim() || null;
  let configuredTokenAddress: string | null = null;
  if (!rawTokenAddress) {
    issues.push("AURX_TOKEN_ADDRESS is required");
  } else if (!isAddress(rawTokenAddress)) {
    issues.push("AURX_TOKEN_ADDRESS is invalid");
  } else {
    configuredTokenAddress = getAddress(rawTokenAddress);
    if (configuredTokenAddress !== AURX_MAINNET_TOKEN_ADDRESS) {
      issues.push(`AURX_TOKEN_ADDRESS must be exactly ${AURX_MAINNET_TOKEN_ADDRESS}`);
    }
  }

  let codeExists = false;
  let codeSizeBytes = 0;
  let tokenName: string | null = null;
  let tokenSymbol: string | null = null;
  let tokenDecimals: number | null = null;
  if (networkReady && configuredTokenAddress === AURX_MAINNET_TOKEN_ADDRESS) {
    try {
      const code = await options.provider.getCode(AURX_MAINNET_TOKEN_ADDRESS);
      codeExists = code !== "0x";
      codeSizeBytes = codeExists ? (code.length - 2) / 2 : 0;
      if (!codeExists) {
        issues.push("AURX address contains no contract bytecode");
      } else {
        [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
          readString(options.provider, AURX_MAINNET_TOKEN_ADDRESS, "name"),
          readString(options.provider, AURX_MAINNET_TOKEN_ADDRESS, "symbol"),
          readDecimals(options.provider, AURX_MAINNET_TOKEN_ADDRESS),
        ]);
        if (tokenSymbol !== "AURX") issues.push(`AURX symbol mismatch: received ${tokenSymbol}`);
        if (tokenDecimals !== 18) issues.push(`AURX decimals mismatch: received ${tokenDecimals}`);
      }
    } catch {
      issues.push("AURX bytecode or metadata read failed");
    }
  }
  const tokenReady = networkReady
    && configuredTokenAddress === AURX_MAINNET_TOKEN_ADDRESS
    && codeExists
    && tokenSymbol === "AURX"
    && tokenDecimals === 18;

  const roleValues = {} as Record<MainnetRoleName, AddressReadinessValue>;
  for (const [role, environmentName] of Object.entries(MAINNET_ROLE_ENVIRONMENT_NAMES) as Array<
    [MainnetRoleName, string]
  >) {
    roleValues[role] = parseConfiguredAddress(environmentName, environment, issues, { rejectTestnetReuse: true });
  }
  const roleAddresses = Object.values(roleValues);
  let rolesReady = roleAddresses.every((value) => value !== "REQUIRED_OWNER_INPUT" && value !== "INVALID");
  if (rolesReady) {
    const approver = roleValues.approver;
    for (const role of ["defaultAdmin", "approverManager", "campaignManager", "pauser", "treasuryRecovery"] as const) {
      if (roleValues[role] === approver) {
        issues.push(`MAINNET_APPROVER_ADDRESS must be separated from ${MAINNET_ROLE_ENVIRONMENT_NAMES[role]}`);
        rolesReady = false;
      }
    }
  }

  const deployerAddress = parseConfiguredAddress(
    "MAINNET_DEPLOYER_ADDRESS",
    environment,
    issues,
    { rejectTestnetReuse: true },
  );
  let deployerBalance: bigint | null = null;
  if (networkReady && deployerAddress !== "REQUIRED_OWNER_INPUT" && deployerAddress !== "INVALID") {
    try {
      deployerBalance = await options.provider.getBalance(deployerAddress);
    } catch {
      issues.push("Mainnet deployer BNB balance read failed");
    }
  }
  const deployerReady = deployerAddress !== "REQUIRED_OWNER_INPUT"
    && deployerAddress !== "INVALID"
    && deployerBalance !== null;

  const configuredRewardAddressRaw = environment.MAINNET_REWARD_CONTRACT_ADDRESS?.trim() || null;
  let configuredRewardAddress: string | null = null;
  if (configuredRewardAddressRaw) {
    if (!isAddress(configuredRewardAddressRaw)) {
      issues.push("MAINNET_REWARD_CONTRACT_ADDRESS is invalid");
    } else {
      configuredRewardAddress = getAddress(configuredRewardAddressRaw);
      if (configuredRewardAddress === TESTNET_REWARD_CONTRACT_ADDRESS) {
        issues.push("MAINNET_REWARD_CONTRACT_ADDRESS must not reuse the Testnet reward contract");
      } else {
        issues.push("MAINNET_REWARD_CONTRACT_ADDRESS must remain empty before the initial Mainnet deployment");
      }
    }
  }
  const guardEnabled = environment.MAINNET_DEPLOYMENT_ENABLED?.trim() === "true";
  if (!guardEnabled) issues.push("MAINNET_DEPLOYMENT_ENABLED is false; enable it only for the one deployment invocation");
  if (!options.compilerBaselineReady) issues.push("Compiler/source/ABI baseline validation failed");

  let gasPrice: bigint | null = null;
  if (networkReady) {
    try {
      const feeData = await options.provider.getFeeData();
      gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? null;
      if (gasPrice === null) issues.push("RPC did not return a readable Mainnet gas price");
    } catch {
      issues.push("Mainnet gas price read failed");
    }
  }

  const constructorNames = [
    "rewardTokenAddress",
    "initialAdmin",
    "initialApproverManager",
    "initialApprover",
    "initialCampaignManager",
    "initialPauser",
    "initialTreasury",
  ];
  const constructorValues = [AURX_MAINNET_TOKEN_ADDRESS, ...roleAddresses];
  const deploymentReady = guardEnabled && configuredRewardAddressRaw === null && gasPrice !== null;
  const overallReady = networkReady && tokenReady && rolesReady && deployerReady
    && options.compilerBaselineReady && deploymentReady;

  return {
    mode: "READ_ONLY",
    transactionsSent: 0,
    network: {
      profile: selectedProfile,
      expectedChainId: 56,
      configuredChainId,
      actualChainId,
      ready: networkReady,
    },
    rewardToken: {
      symbol: tokenSymbol,
      name: tokenName,
      expectedAddress: AURX_MAINNET_TOKEN_ADDRESS,
      configuredAddress: configuredTokenAddress,
      codeExists,
      codeSizeBytes,
      decimals: tokenDecimals,
      ready: tokenReady,
    },
    roles: { ...roleValues, ready: rolesReady },
    deployer: {
      address: deployerAddress,
      balanceWei: deployerBalance?.toString() ?? null,
      balanceBnb: deployerBalance === null ? null : formatEther(deployerBalance),
      ready: deployerReady,
    },
    compiler: { ready: options.compilerBaselineReady, version: "0.8.28", optimizerRuns: 200, evmVersion: "paris", viaIR: false },
    eip712: { name: "AurixRewardClaim", version: "1", chainId: 56, verifyingContract: "FUTURE_MAINNET_REWARD_CONTRACT" },
    constructorArguments: constructorNames.map((parameter, index) => ({
      parameter,
      value: String(constructorValues[index]),
    })),
    deployment: {
      deployed: false,
      configuredAddress: configuredRewardAddress,
      deploymentGuardEnabled: guardEnabled,
      suggestedGasPriceWei: gasPrice?.toString() ?? null,
      suggestedGasPriceGwei: gasPrice === null ? null : formatUnits(gasPrice, "gwei"),
      artifactPattern: "deployments/bsc-mainnet-<contract-address>.json",
      ready: deploymentReady,
    },
    issues,
    overallReady,
  };
}
