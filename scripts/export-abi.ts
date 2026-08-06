import { mkdir, writeFile } from "node:fs/promises";

import { artifacts } from "hardhat";

async function main(): Promise<void> {
  const artifact = await artifacts.readArtifact("AurixRewardClaim");
  await mkdir("abi", { recursive: true });
  await writeFile("abi/AurixRewardClaim.json", `${JSON.stringify(artifact.abi, null, 2)}\n`, "utf8");
  console.log("ABI written to abi/AurixRewardClaim.json");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
