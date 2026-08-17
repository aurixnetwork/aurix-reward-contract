import { expect } from "chai";
import hre, { artifacts } from "hardhat";

import { VALIDATED_BASELINE, validateFrozenBaseline } from "../scripts/lib/baseline";

describe("Testnet-validated Solidity and ABI frozen baseline", function () {
  it("preserves exact source, interface, ABI, and compiler identities", async function () {
    const coverageRunning = (hre as typeof hre & { __SOLIDITY_COVERAGE_RUNNING?: boolean }).__SOLIDITY_COVERAGE_RUNNING === true;
    const result = await validateFrozenBaseline(artifacts, { skipInstrumentedCompilerCheck: coverageRunning });
    expect(result.ready).to.equal(true);
    expect(result.contractSha256).to.equal(VALIDATED_BASELINE.contractSha256);
    expect(result.interfaceSha256).to.equal(VALIDATED_BASELINE.interfaceSha256);
    expect(result.abiSha256).to.equal(VALIDATED_BASELINE.abiSha256);
    expect(result.abiEntries).to.equal(98);
    expect(result.compilerBuildInfoVerified).to.equal(!coverageRunning);
    expect(result.compiler).to.deep.equal(VALIDATED_BASELINE.compiler);
  });
});
