import { expect } from "chai";
import { Wallet, keccak256, toUtf8Bytes, verifyTypedData } from "ethers";

import { getEip712Domain } from "../scripts/lib/config";
import { authorizationTypes, type RewardAuthorization } from "./helpers";

describe("EIP-712 Testnet/Mainnet domain isolation", function () {
  const approver = new Wallet(keccak256(toUtf8Bytes("deterministic-domain-isolation-test-key")));
  const simulatedFutureMainnetContract = "0x0000000000000000000000000000000000000A56";
  const testnetContract = "0x355D58c905f42F4f78abCD7413371F6EE4Dba137";
  const authorization: RewardAuthorization = {
    claimant: "0x0000000000000000000000000000000000000C11",
    amount: 10n ** 18n,
    campaignId: `0x${"11".repeat(32)}`,
    rewardId: `0x${"22".repeat(32)}`,
    rewardNonce: 0n,
    validAfter: 1_800_000_000n,
    deadline: 1_800_003_600n,
  };

  it("builds the validated Testnet domain with chain ID 97", function () {
    expect(getEip712Domain("TESTNET", testnetContract)).to.deep.equal({
      name: "AurixRewardClaim",
      version: "1",
      chainId: 97n,
      verifyingContract: testnetContract,
    });
  });

  it("builds the future Mainnet domain with chain ID 56 and its own verifying contract", function () {
    expect(getEip712Domain("MAINNET", simulatedFutureMainnetContract)).to.deep.equal({
      name: "AurixRewardClaim",
      version: "1",
      chainId: 56n,
      verifyingContract: simulatedFutureMainnetContract,
    });
  });

  it("does not permit Testnet and Mainnet signatures to cross domains", async function () {
    const testnetDomain = getEip712Domain("TESTNET", testnetContract);
    const mainnetDomain = getEip712Domain("MAINNET", simulatedFutureMainnetContract);
    const testnetSignature = await approver.signTypedData(testnetDomain, authorizationTypes, authorization);
    const mainnetSignature = await approver.signTypedData(mainnetDomain, authorizationTypes, authorization);
    expect(testnetSignature).not.to.equal(mainnetSignature);
    expect(verifyTypedData(testnetDomain, authorizationTypes, authorization, testnetSignature)).to.equal(approver.address);
    expect(verifyTypedData(mainnetDomain, authorizationTypes, authorization, mainnetSignature)).to.equal(approver.address);
    expect(verifyTypedData(mainnetDomain, authorizationTypes, authorization, testnetSignature)).not.to.equal(approver.address);
    expect(verifyTypedData(testnetDomain, authorizationTypes, authorization, mainnetSignature)).not.to.equal(approver.address);
  });
});
