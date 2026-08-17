import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { Artifacts } from "hardhat/types";

export const VALIDATED_BASELINE = {
  sourceCommit: "ad1fec6e3b6119eb021db9fed4c47ddc08ca3213",
  contractSha256: "b50386b729a315274ac7b19d4e9f0a1fb6a3e53636696f9236ddabbac054f99d",
  interfaceSha256: "eddb8dd83ffa5f57840bc6702db6291b1d94789f42f827b4841ce3d723a80b30",
  abiSha256: "36eb89b5d3194d3ca82ca46430bec53310067d3fb60223315dbc9ae29abe1c21",
  compiler: {
    version: "0.8.28",
    longVersion: "0.8.28+commit.7893614a",
    optimizerEnabled: true,
    optimizerRuns: 200,
    evmVersion: "paris",
    viaIR: false,
  },
} as const;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export interface BaselineValidationResult {
  ready: true;
  sourceCommit: string;
  contractSha256: string;
  interfaceSha256: string;
  abiSha256: string;
  abiEntries: number;
  compilerBuildInfoVerified: boolean;
  compiler: typeof VALIDATED_BASELINE.compiler;
}

export async function validateFrozenBaseline(
  artifacts: Artifacts,
  options: { skipInstrumentedCompilerCheck?: boolean } = {},
): Promise<BaselineValidationResult> {
  const [contractSource, interfaceSource, abiText] = await Promise.all([
    readFile("contracts/AurixRewardClaim.sol"),
    readFile("contracts/interfaces/IAurixRewardClaim.sol"),
    readFile("abi/AurixRewardClaim.json", "utf8"),
  ]);
  const contractSha256 = sha256(contractSource);
  const interfaceSha256 = sha256(interfaceSource);
  const abiSha256 = sha256(abiText);
  if (contractSha256 !== VALIDATED_BASELINE.contractSha256) throw new Error("Frozen AurixRewardClaim.sol hash changed");
  if (interfaceSha256 !== VALIDATED_BASELINE.interfaceSha256) throw new Error("Frozen IAurixRewardClaim.sol hash changed");
  if (abiSha256 !== VALIDATED_BASELINE.abiSha256) throw new Error("Committed AurixRewardClaim ABI hash changed");

  const artifact = await artifacts.readArtifact("AurixRewardClaim");
  const committedAbi = JSON.parse(abiText) as unknown;
  if (canonicalJson(artifact.abi) !== canonicalJson(committedAbi)) {
    throw new Error("Compiled ABI differs from the validated committed ABI");
  }
  const buildInfo = await artifacts.getBuildInfo("contracts/AurixRewardClaim.sol:AurixRewardClaim");
  if (!buildInfo) throw new Error("AurixRewardClaim build info is unavailable; run compile first");
  const expected = VALIDATED_BASELINE.compiler;
  const compilerMatches = (
    buildInfo.solcVersion !== expected.version
    || buildInfo.solcLongVersion !== expected.longVersion
    || buildInfo.input.settings.optimizer?.enabled !== expected.optimizerEnabled
    || buildInfo.input.settings.optimizer?.runs !== expected.optimizerRuns
    || buildInfo.input.settings.evmVersion !== expected.evmVersion
    || buildInfo.input.settings.viaIR !== expected.viaIR
  ) === false;
  if (!compilerMatches && !options.skipInstrumentedCompilerCheck) {
    throw new Error("Compiler/build configuration differs from the validated baseline");
  }

  return {
    ready: true,
    sourceCommit: VALIDATED_BASELINE.sourceCommit,
    contractSha256,
    interfaceSha256,
    abiSha256,
    abiEntries: artifact.abi.length,
    compilerBuildInfoVerified: compilerMatches,
    compiler: expected,
  };
}
