require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

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
};
