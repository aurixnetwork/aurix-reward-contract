import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import "dotenv/config";

import type { HardhatUserConfig } from "hardhat/config";

const testnetRpcUrl = process.env.BSC_TESTNET_RPC_URL ?? "";
const mainnetRpcUrl = process.env.BSC_MAINNET_RPC_URL ?? "";
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const etherscanApiKey = process.env.ETHERSCAN_API_KEY ?? "";

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
      url: testnetRpcUrl,
      chainId: 97,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
    bscTestnetReadOnly: {
      url: testnetRpcUrl,
      chainId: 97,
      accounts: [],
    },
    bscMainnet: {
      url: mainnetRpcUrl,
      chainId: 56,
      accounts: [],
    },
    bscMainnetReadOnly: {
      url: mainnetRpcUrl,
      chainId: 56,
      accounts: [],
    },
  },
  etherscan: {
    apiKey: etherscanApiKey,
  },
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify.dev/server",
    browserUrl: "https://repo.sourcify.dev",
  },
  mocha: {
    timeout: 40_000,
  },
};

export default config;
