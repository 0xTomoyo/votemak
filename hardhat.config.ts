import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import { HardhatUserConfig, NetworkUserConfig } from "hardhat/types";
import fsExtra from "fs-extra";
import { TASK_CLEAN } from "hardhat/builtin-tasks/task-names";
import { task } from "hardhat/config";
import { getEnvWarn } from "./src/utils";

const chainIds = {
  goerli: 5,
  hardhat: 1337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
  "polygon-mainnet": 137,
};
const mnemonic = getEnvWarn("MNEMONIC");
const infuraApiKey = getEnvWarn("INFURA_API_KEY");
const etherscanApiKey = getEnvWarn("ETHERSCAN");
getEnvWarn("ETH_RPC_URL");
getEnvWarn("POLYGON_RPC_URL");

function getChainConfig(network: keyof typeof chainIds, apiKey: string): NetworkUserConfig {
  return {
    url: `https://${network}.infura.io/v3/${apiKey}`,
    chainId: chainIds[network],
    ...(mnemonic && {
      accounts: {
        count: 10,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
    }),
  };
}

task(TASK_CLEAN, "Overrides the standard clean task", async function (_taskArgs, _hre, runSuper) {
  await fsExtra.remove("./coverage");
  await fsExtra.remove("./coverage.json");
  await fsExtra.remove("./data/reactors");
  await runSuper();
});

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: "USD",
    enabled: true,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      chainId: chainIds.hardhat,
    },
    ...(infuraApiKey && {
      mainnet: getChainConfig("mainnet", infuraApiKey),
      goerli: getChainConfig("goerli", infuraApiKey),
      kovan: getChainConfig("kovan", infuraApiKey),
      rinkeby: getChainConfig("rinkeby", infuraApiKey),
      ropsten: getChainConfig("ropsten", infuraApiKey),
      matic: getChainConfig("polygon-mainnet", infuraApiKey),
    }),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          metadata: {
            // Not including the metadata hash
            // https://github.com/paulrberg/solidity-template/issues/31
            bytecodeHash: "none",
          },
          // Disable the optimizer when debugging
          // https://hardhat.org/hardhat-network/#solidity-optimizer-support
          optimizer: {
            enabled: true,
            runs: 800,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 600000,
  },
  typechain: {
    outDir: "src/types/typechain",
    target: "ethers-v5",
    externalArtifacts: ["src/contracts/*.json"],
  },
  etherscan: {
    apiKey: etherscanApiKey,
  },
  namedAccounts: {
    deployer: 0,
  },
};

export default config;
