import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import "dotenv/config";

import type { HardhatUserConfig } from "hardhat/config";

const rpcUrl = process.env.BSC_TESTNET_RPC_URL ?? "";
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",
      viaIR: false,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    bscTestnet: {
      url: rpcUrl,
      chainId: 97,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env.BSCSCAN_API_KEY ?? "",
    },
  },
  sourcify: {
    enabled: false,
  },
  mocha: {
    timeout: 40_000,
  },
};

export default config;
