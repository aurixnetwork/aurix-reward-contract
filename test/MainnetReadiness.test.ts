import { expect } from "chai";
import { Interface, getAddress } from "ethers";

import {
  AURX_MAINNET_TOKEN_ADDRESS,
  IRB_TEST_TOKEN_ADDRESS,
  NETWORK_PROFILES,
  TESTNET_REWARD_CONTRACT_ADDRESS,
  assertProfileConnection,
  getMainnetConstructorArguments,
  requireMainnetDeploymentGuard,
} from "../scripts/lib/config";
import { buildMainnetReadiness, type ReadOnlyProvider } from "../scripts/lib/mainnet-readiness";

const tokenInterface = new Interface([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

const MAINNET_ADDRESSES = {
  MAINNET_DEPLOYER_ADDRESS: "0x0000000000000000000000000000000000000101",
  MAINNET_DEFAULT_ADMIN_ADDRESS: "0x0000000000000000000000000000000000000102",
  MAINNET_APPROVER_MANAGER_ADDRESS: "0x0000000000000000000000000000000000000103",
  MAINNET_APPROVER_ADDRESS: "0x0000000000000000000000000000000000000104",
  MAINNET_CAMPAIGN_MANAGER_ADDRESS: "0x0000000000000000000000000000000000000105",
  MAINNET_PAUSER_ADDRESS: "0x0000000000000000000000000000000000000106",
  MAINNET_TREASURY_RECOVERY_ADDRESS: "0x0000000000000000000000000000000000000107",
} as const;

const READY_ENVIRONMENT = {
  AURIX_NETWORK_PROFILE: "MAINNET",
  AURX_TOKEN_ADDRESS: AURX_MAINNET_TOKEN_ADDRESS,
  MAINNET_DEPLOYMENT_ENABLED: "true",
  MAINNET_REWARD_CONTRACT_ADDRESS: "",
  ...MAINNET_ADDRESSES,
} as const;

class FakeReadOnlyProvider implements ReadOnlyProvider {
  public readCalls = 0;
  public writeCalls = 0;

  public constructor(
    private readonly chainId = 56n,
    private readonly code = "0x60006000",
    private readonly metadata = { name: "Aurix Network", symbol: "AURX", decimals: 18n },
  ) {}

  public async getNetwork(): Promise<{ chainId: bigint }> {
    this.readCalls += 1;
    return { chainId: this.chainId };
  }

  public async getCode(): Promise<string> {
    this.readCalls += 1;
    return this.code;
  }

  public async call(transaction: { data: string }): Promise<string> {
    this.readCalls += 1;
    const selector = transaction.data.slice(0, 10);
    if (selector === tokenInterface.getFunction("name")!.selector) {
      return tokenInterface.encodeFunctionResult("name", [this.metadata.name]);
    }
    if (selector === tokenInterface.getFunction("symbol")!.selector) {
      return tokenInterface.encodeFunctionResult("symbol", [this.metadata.symbol]);
    }
    return tokenInterface.encodeFunctionResult("decimals", [this.metadata.decimals]);
  }

  public async getBalance(): Promise<bigint> {
    this.readCalls += 1;
    return 1_000_000_000_000_000_000n;
  }

  public async getFeeData(): Promise<{ gasPrice: bigint }> {
    this.readCalls += 1;
    return { gasPrice: 3_000_000_000n };
  }
}

async function readiness(
  provider = new FakeReadOnlyProvider(),
  environment: Readonly<Record<string, string | undefined>> = READY_ENVIRONMENT,
  configuredChainId = 56,
) {
  return buildMainnetReadiness({ provider, environment, configuredChainId, compilerBaselineReady: true });
}

describe("BNB Smart Chain network profiles and Mainnet readiness", function () {
  it("keeps the validated Testnet profile independently addressable", function () {
    expect(NETWORK_PROFILES.TESTNET.chainId).to.equal(97n);
    expect(NETWORK_PROFILES.TESTNET.rewardTokenAddress).to.equal(IRB_TEST_TOKEN_ADDRESS);
    expect(NETWORK_PROFILES.TESTNET.rewardContractAddress).to.equal(TESTNET_REWARD_CONTRACT_ADDRESS);
  });

  it("defines Mainnet as chain 56 with AURX and no assumed reward deployment", function () {
    expect(NETWORK_PROFILES.MAINNET.chainId).to.equal(56n);
    expect(NETWORK_PROFILES.MAINNET.rewardTokenAddress).to.equal(AURX_MAINNET_TOKEN_ADDRESS);
    expect(NETWORK_PROFILES.MAINNET.rewardContractAddress).to.equal(null);
  });

  it("accepts the fixed AURX address, bytecode, symbol, and 18 decimals", async function () {
    const report = await readiness();
    expect(report.rewardToken).to.include({
      expectedAddress: AURX_MAINNET_TOKEN_ADDRESS,
      configuredAddress: AURX_MAINNET_TOKEN_ADDRESS,
      codeExists: true,
      symbol: "AURX",
      decimals: 18,
      ready: true,
    });
    expect(report.overallReady).to.equal(true);
  });

  it("fails Mainnet readiness when a Testnet RPC reports chain 97", async function () {
    const report = await readiness(new FakeReadOnlyProvider(97n));
    expect(report.network.actualChainId).to.equal(97);
    expect(report.network.ready).to.equal(false);
    expect(report.overallReady).to.equal(false);
  });

  it("rejects a Testnet chain 97 connection for the Mainnet profile", function () {
    expect(() => assertProfileConnection("MAINNET", 56, 97n)).to.throw("MAINNET requires configured and RPC chain ID 56");
  });

  it("rejects a Mainnet chain 56 connection for the Testnet profile", function () {
    expect(() => assertProfileConnection("TESTNET", 97, 56n)).to.throw("TESTNET requires configured and RPC chain ID 97");
  });

  it("fails a Testnet-selected profile connected to Mainnet chain 56", async function () {
    const report = await readiness(new FakeReadOnlyProvider(56n), { ...READY_ENVIRONMENT, AURIX_NETWORK_PROFILE: "TESTNET" });
    expect(report.network.actualChainId).to.equal(56);
    expect(report.network.ready).to.equal(false);
  });

  it("fails when Hardhat network configuration is not chain 56", async function () {
    const report = await readiness(new FakeReadOnlyProvider(56n), READY_ENVIRONMENT, 97);
    expect(report.network.configuredChainId).to.equal(97);
    expect(report.network.ready).to.equal(false);
  });

  it("rejects the IRB Testnet token address as a Mainnet token", async function () {
    const report = await readiness(undefined, { ...READY_ENVIRONMENT, AURX_TOKEN_ADDRESS: IRB_TEST_TOKEN_ADDRESS });
    expect(report.rewardToken.ready).to.equal(false);
    expect(report.overallReady).to.equal(false);
  });

  it("rejects any incorrect Mainnet token address", async function () {
    const report = await readiness(undefined, { ...READY_ENVIRONMENT, AURX_TOKEN_ADDRESS: MAINNET_ADDRESSES.MAINNET_DEFAULT_ADMIN_ADDRESS });
    expect(report.rewardToken.ready).to.equal(false);
  });

  it("fails when no bytecode exists at the AURX address", async function () {
    const report = await readiness(new FakeReadOnlyProvider(56n, "0x"));
    expect(report.rewardToken.codeExists).to.equal(false);
    expect(report.rewardToken.ready).to.equal(false);
  });

  it("fails when AURX decimals are not 18", async function () {
    const report = await readiness(new FakeReadOnlyProvider(56n, "0x6000", { name: "Aurix Network", symbol: "AURX", decimals: 8n }));
    expect(report.rewardToken.decimals).to.equal(8);
    expect(report.rewardToken.ready).to.equal(false);
  });

  it("fails when AURX symbol is not AURX", async function () {
    const report = await readiness(new FakeReadOnlyProvider(56n, "0x6000", { name: "IRISBANK", symbol: "IRB", decimals: 18n }));
    expect(report.rewardToken.ready).to.equal(false);
  });

  it("reports every missing Mainnet role and deployer as REQUIRED_OWNER_INPUT", async function () {
    const report = await readiness(undefined, {
      AURIX_NETWORK_PROFILE: "MAINNET",
      AURX_TOKEN_ADDRESS: AURX_MAINNET_TOKEN_ADDRESS,
      MAINNET_DEPLOYMENT_ENABLED: "false",
    });
    expect(report.roles.defaultAdmin).to.equal("REQUIRED_OWNER_INPUT");
    expect(report.roles.approverManager).to.equal("REQUIRED_OWNER_INPUT");
    expect(report.roles.approver).to.equal("REQUIRED_OWNER_INPUT");
    expect(report.roles.campaignManager).to.equal("REQUIRED_OWNER_INPUT");
    expect(report.roles.pauser).to.equal("REQUIRED_OWNER_INPUT");
    expect(report.roles.treasuryRecovery).to.equal("REQUIRED_OWNER_INPUT");
    expect(report.deployer.address).to.equal("REQUIRED_OWNER_INPUT");
    expect(report.overallReady).to.equal(false);
  });

  it("rejects invalid and zero Mainnet role addresses", async function () {
    const report = await readiness(undefined, {
      ...READY_ENVIRONMENT,
      MAINNET_DEFAULT_ADMIN_ADDRESS: "not-an-address",
      MAINNET_PAUSER_ADDRESS: "0x0000000000000000000000000000000000000000",
    });
    expect(report.roles.defaultAdmin).to.equal("INVALID");
    expect(report.roles.pauser).to.equal("INVALID");
    expect(report.roles.ready).to.equal(false);
  });

  it("rejects silent reuse of a reviewed Testnet role address", async function () {
    const report = await readiness(undefined, {
      ...READY_ENVIRONMENT,
      MAINNET_DEFAULT_ADMIN_ADDRESS: "0x2A37820df48d298De3907557b02301A46C2e127f",
    });
    expect(report.roles.defaultAdmin).to.equal("INVALID");
  });

  it("requires the Approver to remain separated from operational roles", async function () {
    const report = await readiness(undefined, {
      ...READY_ENVIRONMENT,
      MAINNET_PAUSER_ADDRESS: MAINNET_ADDRESSES.MAINNET_APPROVER_ADDRESS,
    });
    expect(report.roles.ready).to.equal(false);
    expect(report.issues.some((issue) => issue.includes("MAINNET_APPROVER_ADDRESS must be separated"))).to.equal(true);
  });

  it("keeps the deployment guard false unless its value is exactly true", async function () {
    for (const value of [undefined, "", "false", "TRUE", "1"]) {
      const report = await readiness(undefined, { ...READY_ENVIRONMENT, MAINNET_DEPLOYMENT_ENABLED: value });
      expect(report.deployment.deploymentGuardEnabled).to.equal(false);
      expect(report.overallReady).to.equal(false);
    }
  });

  it("requires the explicit one-shot guard before deployment", function () {
    expect(() => requireMainnetDeploymentGuard({ MAINNET_DEPLOYMENT_ENABLED: "false" })).to.throw(
      "MAINNET_DEPLOYMENT_ENABLED must be exactly true",
    );
    expect(() => requireMainnetDeploymentGuard({ MAINNET_DEPLOYMENT_ENABLED: "true" })).not.to.throw();
  });

  it("rejects any pre-populated Mainnet reward contract address", async function () {
    const report = await readiness(undefined, {
      ...READY_ENVIRONMENT,
      MAINNET_REWARD_CONTRACT_ADDRESS: TESTNET_REWARD_CONTRACT_ADDRESS,
    });
    expect(report.deployment.configuredAddress).to.equal(TESTNET_REWARD_CONTRACT_ADDRESS);
    expect(report.deployment.ready).to.equal(false);
    expect(report.overallReady).to.equal(false);
  });

  it("maps approved Mainnet roles into the frozen constructor order", function () {
    expect(getMainnetConstructorArguments(READY_ENVIRONMENT)).to.deep.equal([
      AURX_MAINNET_TOKEN_ADDRESS,
      ...Object.values(MAINNET_ADDRESSES).slice(1).map(getAddress),
    ]);
  });

  it("fails readiness when compiler/source/ABI identity is not the baseline", async function () {
    const report = await buildMainnetReadiness({
      provider: new FakeReadOnlyProvider(),
      environment: READY_ENVIRONMENT,
      configuredChainId: 56,
      compilerBaselineReady: false,
    });
    expect(report.compiler.ready).to.equal(false);
    expect(report.overallReady).to.equal(false);
  });

  it("performs only read calls and reports zero blockchain transactions", async function () {
    const provider = new FakeReadOnlyProvider();
    const report = await readiness(provider);
    expect(provider.readCalls).to.be.greaterThan(0);
    expect(provider.writeCalls).to.equal(0);
    expect(report.mode).to.equal("READ_ONLY");
    expect(report.transactionsSent).to.equal(0);
  });

  it("never includes configured secrets in readiness JSON", async function () {
    const secrets = {
      BSC_MAINNET_RPC_URL: "https://rpc.invalid/super-secret",
      MAINNET_DEPLOYER_PRIVATE_KEY: `0x${"aa".repeat(32)}`,
      ETHERSCAN_API_KEY: "secret-api-key",
    };
    const reportText = JSON.stringify(await readiness(undefined, { ...READY_ENVIRONMENT, ...secrets }));
    for (const secret of Object.values(secrets)) expect(reportText).not.to.include(secret);
  });
});
