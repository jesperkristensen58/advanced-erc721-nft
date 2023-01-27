require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require('dotenv').config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.9",
  settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
    },
  gasReporter: {
    enabled: true,
    currency: 'USD'
  },
  mocha: {
    timeout: 1000000000
  },
  networks: {
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.POLYGON_PRIVATE_KEY]
    },
    hardhat: {
      allowUnlimitedContractSize: true
  },
  },
  etherscan: {
    apiKey: process.env.POLYSCAN_API_KEY,
  },
};
