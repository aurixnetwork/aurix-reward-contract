import { getAddress, isAddress } from "ethers";

export const BSC_TESTNET_CHAIN_ID = 97n;
export const IRB_TEST_TOKEN_ADDRESS = "0x7daf7fE962B123A6698D5e3a109c551872790AeA";

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function requireAddressEnv(name: string): string {
  const value = requireEnv(name);
  if (!isAddress(value) || getAddress(value) === getAddress("0x0000000000000000000000000000000000000000")) {
    throw new Error(`${name} must be a nonzero EVM address`);
  }
  return getAddress(value);
}

export function parsePositiveInteger(value: string, name: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an unsigned integer`);
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero`);
  return parsed;
}
