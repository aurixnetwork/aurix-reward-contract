import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { Contract, getAddress, type Provider } from "ethers";

import { BSC_TESTNET_CHAIN_ID, IRB_TEST_TOKEN_ADDRESS } from "./config";

const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
] as const;

export interface IrbPreflightReport {
  checkedAtUtc: string;
  chainId: string;
  tokenAddress: string;
  codeSizeBytes: number;
  name: string;
  symbol: string;
  decimals: number;
  totalSupplyBaseUnits: string;
}

export async function validateIrbToken(
  provider: Provider,
  reportPath?: string,
): Promise<IrbPreflightReport> {
  const network = await provider.getNetwork();
  if (network.chainId !== BSC_TESTNET_CHAIN_ID) {
    throw new Error(`Wrong network: expected chain ID 97, received ${network.chainId}`);
  }

  const configuredAddress = process.env.IRB_TEST_TOKEN_ADDRESS?.trim();
  if (!configuredAddress) throw new Error("IRB_TEST_TOKEN_ADDRESS is required");
  if (getAddress(configuredAddress) !== IRB_TEST_TOKEN_ADDRESS) {
    throw new Error(`IRB_TEST_TOKEN_ADDRESS must be exactly ${IRB_TEST_TOKEN_ADDRESS}`);
  }

  const code = await provider.getCode(IRB_TEST_TOKEN_ADDRESS);
  if (code === "0x") throw new Error("IRB token address contains no contract bytecode");

  const token = new Contract(IRB_TEST_TOKEN_ADDRESS, TOKEN_ABI, provider);
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    token.name() as Promise<string>,
    token.symbol() as Promise<string>,
    token.decimals() as Promise<bigint>,
    token.totalSupply() as Promise<bigint>,
  ]);

  if (name !== "IRISBANK") throw new Error(`Unexpected token name: ${name}`);
  if (symbol !== "IRB") throw new Error(`Unexpected token symbol: ${symbol}`);

  const report: IrbPreflightReport = {
    checkedAtUtc: new Date().toISOString(),
    chainId: network.chainId.toString(),
    tokenAddress: IRB_TEST_TOKEN_ADDRESS,
    codeSizeBytes: (code.length - 2) / 2,
    name,
    symbol,
    decimals: Number(decimals),
    totalSupplyBaseUnits: totalSupply.toString(),
  };

  if (reportPath) {
    const absolutePath = resolve(reportPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  return report;
}
