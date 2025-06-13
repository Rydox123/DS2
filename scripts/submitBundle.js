const { ethers } = require("ethers");
const { FlashbotsBundleProvider } = require("@flashbots/ethers-provider-bundle");

// Accept provider as a parameter!
async function submitBundle(signedTxs, provider) {
  if (!provider) {
    throw new Error("Provider must be passed to submitBundle!");
  }
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const authSigner = ethers.Wallet.createRandom();

  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner
  );

  const blockNumber = await provider.getBlockNumber();
  const response = await flashbotsProvider.sendBundle(
    signedTxs, // Array of signed transactions
    blockNumber + 1
  );
  const waitResponse = await response.wait();
  if (waitResponse === 0) {
    console.log("✅ Bundle included!");
  } else {
    console.log("❌ Bundle not included.");
  }
}

module.exports = submitBundle;
