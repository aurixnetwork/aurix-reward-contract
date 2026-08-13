import { expect } from "chai";

import {
  EXPECTED_INITIAL_ROLE_ADDRESSES,
  formatErrorSafely,
  getTestnetConstructorArguments,
} from "../scripts/lib/config";

describe("BSC Testnet deployment configuration", function () {
  it("maps every fixed role address into the constructor in order", function () {
    const environment = { ...EXPECTED_INITIAL_ROLE_ADDRESSES };
    expect(getTestnetConstructorArguments(environment)).to.deep.equal([
      "0x7daf7fE962B123A6698D5e3a109c551872790AeA",
      EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_ADMIN_ADDRESS,
      EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_MANAGER_ADDRESS,
      EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_ADDRESS,
      EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_CAMPAIGN_MANAGER_ADDRESS,
      EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_PAUSER_ADDRESS,
      EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_TREASURY_ADDRESS,
    ]);
  });

  it("rejects a role address that differs from the reviewed deployment plan", function () {
    const environment = {
      ...EXPECTED_INITIAL_ROLE_ADDRESSES,
      INITIAL_APPROVER_ADDRESS: "0x0000000000000000000000000000000000000001",
    };
    expect(() => getTestnetConstructorArguments(environment)).to.throw(
      `INITIAL_APPROVER_ADDRESS must be exactly ${EXPECTED_INITIAL_ROLE_ADDRESSES.INITIAL_APPROVER_ADDRESS}`,
    );
  });

  it("redacts configured credentials from surfaced errors", function () {
    const environment = {
      BSC_TESTNET_RPC_URL: "https://rpc.invalid/example-credential",
      DEPLOYER_PRIVATE_KEY: "example-private-value",
      ETHERSCAN_API_KEY: "example-api-value",
    };
    const result = formatErrorSafely(
      new Error("https://rpc.invalid/example-credential example-private-value example-api-value"),
      environment,
    );
    expect(result).to.equal(
      "[REDACTED:BSC_TESTNET_RPC_URL] [REDACTED:DEPLOYER_PRIVATE_KEY] [REDACTED:ETHERSCAN_API_KEY]",
    );
  });
});
