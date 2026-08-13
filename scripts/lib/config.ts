import { getAddress, isAddress, Wallet, type Provider } from "ethers";

export const BSC_TESTNET_CHAIN_ID = 97n;
export const IRB_TEST_TOKEN_ADDRESS = "0x7daf7fE962B123A6698D5e3a109c551872790AeA";
export const BSC_TESTNET_DEPLOYER_ADDRESS = "0x2A37820df48d298De3907557b02301A46C2e127f";

export const EXPECTED_INITIAL_ROLE_ADDRESSES = {
  INITIAL_ADMIN_ADDRESS: "0x2A37820df48d298De3907557b02301A46C2e127f",
  INITIAL_APPROVER_MANAGER_ADDRESS: "0x2A37820df48d298De3907557b02301A46C2e127f",
  INITIAL_APPROVER_ADDRESS: "0x425f7117D36aC8F45224E895e583b404E0a6eb05",
  INITIAL_CAMPAIGN_MANAGER_ADDRESS: "0x9B2fB8ED115242477C9a8Ea511a0D85E122E1FbE",
  INITIAL_PAUSER_ADDRESS: "0x9B2fB8ED115242477C9a8Ea511a0D85E122E1FbE",
  INITIAL_TREASURY_ADDRESS: "0x2A37820df48d298De3907557b02301A46C2e127f",
} as const;

export type Environment = Readonly<Record<string, string | undefined>>;
export type TestnetConstructorArguments = readonly [string, string, string, string, string, string, string];

export function requireEnv(name: string, environment: Environment = process.env): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function requireAddressEnv(name: string, environment: Environment = process.env): string {
  const value = requireEnv(name, environment);
  if (!isAddress(value) || getAddress(value) === getAddress("0x0000000000000000000000000000000000000000")) {
    throw new Error(`${name} must be a nonzero EVM address`);
  }
  return getAddress(value);
}

export function requireExpectedAddressEnv(
  name: keyof typeof EXPECTED_INITIAL_ROLE_ADDRESSES,
  environment: Environment = process.env,
): string {
  const address = requireAddressEnv(name, environment);
  const expected = EXPECTED_INITIAL_ROLE_ADDRESSES[name];
  if (address !== expected) throw new Error(`${name} must be exactly ${expected}`);
  return address;
}

export function getTestnetConstructorArguments(
  environment: Environment = process.env,
): TestnetConstructorArguments {
  return [
    IRB_TEST_TOKEN_ADDRESS,
    requireExpectedAddressEnv("INITIAL_ADMIN_ADDRESS", environment),
    requireExpectedAddressEnv("INITIAL_APPROVER_MANAGER_ADDRESS", environment),
    requireExpectedAddressEnv("INITIAL_APPROVER_ADDRESS", environment),
    requireExpectedAddressEnv("INITIAL_CAMPAIGN_MANAGER_ADDRESS", environment),
    requireExpectedAddressEnv("INITIAL_PAUSER_ADDRESS", environment),
    requireExpectedAddressEnv("INITIAL_TREASURY_ADDRESS", environment),
  ];
}

export function getValidatedTestnetDeployer(
  provider: Provider,
  environment: Environment = process.env,
): Wallet {
  const privateKey = requireEnv("DEPLOYER_PRIVATE_KEY", environment);
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY is not a valid 32-byte hexadecimal private key");
  }

  let deployer: Wallet;
  try {
    deployer = new Wallet(privateKey, provider);
  } catch {
    throw new Error("DEPLOYER_PRIVATE_KEY is invalid");
  }
  if (deployer.address !== BSC_TESTNET_DEPLOYER_ADDRESS) {
    throw new Error(`Configured deployer must derive to ${BSC_TESTNET_DEPLOYER_ADDRESS}`);
  }
  return deployer;
}

export function formatErrorSafely(error: unknown, environment: Environment = process.env): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const name of ["BSC_TESTNET_RPC_URL", "DEPLOYER_PRIVATE_KEY", "ETHERSCAN_API_KEY"]) {
    const secret = environment[name]?.trim();
    if (!secret) continue;
    message = message.split(secret).join(`[REDACTED:${name}]`);
    if (name === "DEPLOYER_PRIVATE_KEY") {
      const withoutPrefix = secret.replace(/^0x/, "");
      message = message.split(withoutPrefix).join(`[REDACTED:${name}]`);
    }
  }
  return message;
}

export function parsePositiveInteger(value: string, name: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an unsigned integer`);
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero`);
  return parsed;
}
