const { ethers } = require("ethers");
const { simulateArbitrage } = require("./opportunityProcessor");

const WS_URL = "ws://127.0.0.1:8545";
const SWAP_SIGNATURE = "0xd78ad95f";

async function main() {
  const provider = new ethers.WebSocketProvider(WS_URL);

  provider.on("pending", async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (tx && tx.data && tx.data.startsWith(SWAP_SIGNATURE)) {
        console.log("Swap detected:", txHash);
        // Example: call simulateArbitrage with dummy tokens/amount
        await simulateArbitrage(
          "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
          ethers.parseEther("1")
        );
      }
    } catch (e) {}
  });

  console.log("Mempool watcher started.");
}

main();
