require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();


module.exports = {
  solidity: "0.8.20",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      gas: "auto",
      gasPrice: "auto",
      initialBaseFeePerGas: 0,
      allowUnlimitedContractSize: true,
    },
    ethereum: {
      url: process.env.ETH_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1,
    },
    base: {
      url: process.env.BASE_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453, // Base mainnet
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 42161, // Arbitrum One
    },
    // For testnets (recommended for dev)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 11155111,
    },
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 84532,
    }
  }
};
