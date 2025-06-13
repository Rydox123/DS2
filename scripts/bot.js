require('dotenv').config();
const { ethers } = require("ethers");
const { FlashbotsBundleProvider } = require("@flashbots/ethers-provider-bundle");

// ---- 1. Chain Config ----
const CHAIN_CONFIG = {
  ethereum: {
    rpc: process.env.ETH_RPC_URL,
    ws: process.env.ETH_RPC_WS_URL,
    contract: process.env.ETHEREUM_CONTRACT_ADDRESS,
    minProfit: 0.003,
    profitMultiplier: 1.0,
    gasStrategy: 'aggressive',
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  },
  base: {
    rpc: process.env.BASE_RPC_URL,
    ws: process.env.BASE_RPC_WS_URL,
    contract: process.env.BASE_CONTRACT_ADDRESS,
    minProfit: 0.0003,
    profitMultiplier: 1.8,
    gasStrategy: 'conservative',
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0xA0b862F60aE3dA2A8ba2fE8b051bF4dF9D5bE5b6"
  },
  arbitrum: {
    rpc: process.env.ARBITRUM_RPC_URL,
    ws: process.env.ARBITRUM_RPC_WS_URL,
    contract: process.env.ARBITRUM_CONTRACT_ADDRESS,
    minProfit: 0.0005,
    profitMultiplier: 1.5,
    gasStrategy: 'dynamic',
    WETH: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    USDC: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8"
  },
  sepolia: {
    rpc: process.env.SEPOLIA_RPC_URL,
    ws: process.env.SEPOLIA_RPC_WS_URL,
    contract: process.env.SEPOLIA_CONTRACT_ADDRESS,
    minProfit: 0.001,
    profitMultiplier: 1.0,
    gasStrategy: 'testnet',
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0xDFA5c5f5c8d8F1C1d5D1bE3D5B1c6bB9f5B6bB9f"
  }
};

const ACTIVE_CHAIN = process.env.ACTIVE_CHAIN || "sepolia";
const config = CHAIN_CONFIG[ACTIVE_CHAIN];
if (!config) throw new Error(`Unknown chain: ${ACTIVE_CHAIN}`);

// ---- 2. RPC Failover Logic ----
function createProvider(urls) {
  for (const url of urls) {
    try {
      const p = new ethers.WebSocketProvider(url);
      return p;
    } catch (e) {
      console.warn(`Failed to connect to ${url}, trying next...`);
    }
  }
  throw new Error("All RPC endpoints failed!");
}
const rpcUrls = [config.ws, config.rpc].filter(Boolean);
const provider = createProvider(rpcUrls);

console.log(`Connecting to ${ACTIVE_CHAIN} with WS URL: ${provider.connection.url}`);
console.log(`MEV bot started. Watching ${ACTIVE_CHAIN} mempool...`);

// ---- 3. Throttling/Batching Logic ----
let txCounter = 0;
const THROTTLE_N = 20; // Only process every 20th tx

// ---- 4. Inlined Opportunity Simulation ----
const cache = new Map();
async function simulateArbitrage(tokenIn, tokenOut, amountIn, provider) {
  const cacheKey = `${tokenIn}_${tokenOut}_${amountIn}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  // Placeholder: Replace with real DEX reserve fetching and simulation
  // Example: use ethers.Contract to call getReserves() if needed
  const profit = Math.random() > 0.7 ? 100 : 0; // Dummy: randomly profitable
  const result = profit > 0 ? { profitable: true, profit, signedTx: null } : { profitable: false, profit: 0 };
  cache.set(cacheKey, result);
  return result;
}

// ---- 5. Inlined Bundle Submission ----
async function submitBundle(signedTxs, provider) {
  // Placeholder: Add Flashbots/MEV-Share/FPGA logic here as needed
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const authSigner = ethers.Wallet.createRandom();
  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner);

  const blockNumber = await provider.getBlockNumber();
  const response = await flashbotsProvider.sendBundle(signedTxs, blockNumber + 1);
  const waitResponse = await response.wait();
  if (waitResponse === 0) {
    console.log("✅ Bundle included!");
  } else {
    console.log("❌ Bundle not included.");
  }
}

// ---- 6. Routing Function (Multi-Chain Ready) ----
async function routeOpportunity(opp) {
  let bestChain = null;
  let bestScore = 0;
  for (const chain in CHAIN_CONFIG) {
    const score = opp.profit * CHAIN_CONFIG[chain].profitMultiplier;
    if (score > bestScore) {
      bestScore = score;
      bestChain = chain;
    }
  }
  if (bestChain) {
    console.log(`Routing opportunity to chain: ${bestChain} with score: ${bestScore}`);
    // Submit to selected chain (here, just current chain for simplicity)
    // await submitBundle([opp.signedTx], provider);
  } else {
    console.log('No profitable chain found for opportunity');
  }
}

// ---- 7. Main Mempool Watcher ----
provider.on("pending", async (txHash) => {
  txCounter++;
  if (txCounter % THROTTLE_N !== 0) return; // Throttle requests
  try {
    const tx = await provider.getTransaction(txHash);
    if (tx && tx.data && tx.data.startsWith("0xd78ad95f")) {
      // (Optional) GPU/WASM filtering can be added here in future
      const opp = await simulateArbitrage(
        config.WETH,
        config.USDC,
        ethers.parseEther("1"),
        provider
      );
      if (opp && opp.profitable) {
        await routeOpportunity(opp);
        // Uncomment below to actually submit bundles
        // await submitBundle([opp.signedTx], provider);
      } else {
        console.log('No profitable opportunity detected');
      }
    }
  } catch (e) {
    if (e.code === 429) {
      console.warn("Rate limited by provider, backing off...");
      await new Promise(res => setTimeout(res, 2000));
    } else {
      console.error('Error processing pending tx:', e);
    }
  }
});
