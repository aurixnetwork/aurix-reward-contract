import { ethers } from "hardhat";

import { requireAddressEnv } from "./lib/config";

async function main(): Promise<void> {
  const address = requireAddressEnv("REWARD_CONTRACT_ADDRESS");
  const contract = await ethers.getContractAt("AurixRewardClaim", address);
  const [network, rewardToken, paused, name, version] = await Promise.all([
    ethers.provider.getNetwork(),
    contract.rewardToken(),
    contract.paused(),
    contract.eip712Name(),
    contract.eip712Version(),
  ]);
  console.log(JSON.stringify({
    chainId: network.chainId.toString(),
    contractAddress: address,
    rewardToken,
    paused,
    eip712: { name, version },
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
