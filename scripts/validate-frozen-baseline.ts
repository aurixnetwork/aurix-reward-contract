import { artifacts } from "hardhat";

import { validateFrozenBaseline } from "./lib/baseline";
import { formatErrorSafely } from "./lib/config";

async function main(): Promise<void> {
  const report = await validateFrozenBaseline(artifacts);
  console.log(JSON.stringify({ ...report, solidityBusinessLogicChanged: false }, null, 2));
}

main().catch((error: unknown) => {
  console.error(formatErrorSafely(error));
  process.exitCode = 1;
});
