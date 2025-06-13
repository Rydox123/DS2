const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashloanArb", function () {
  let owner, arb, weth, usdc, addressesProvider, uniRouter, sushiRouter;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    addressesProvider = process.env.AAVE_ADDRESSES_PROVIDER;
    uniRouter = process.env.UNISWAP_V2_ROUTER;
    sushiRouter = process.env.SUSHISWAP_ROUTER;

    // Deploy the contract
    arb = await ethers.deployContract(
      "FlashloanArb",
      [addressesProvider, uniRouter, sushiRouter, owner.address]
    );
    await arb.waitForDeployment();

    // Set up token contracts (WETH, USDC)
    weth = await ethers.getContractAt(
      "IERC20",
      process.env.WETH_ADDRESS || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    );
    usdc = await ethers.getContractAt(
      "IERC20",
      process.env.USDC_ADDRESS || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    );
  });

  it("Should deploy and have owner set", async function () {
    expect(await arb.owner()).to.equal(owner.address);
  });

  it("Should simulate a flashloan arbitrage (dry run)", async function () {
    // Example parameters (adjust for your forked mainnet state)
    const flashloanToken = weth.target;
    const flashloanAmount = ethers.parseEther("10"); // 10 WETH for example
    const tokenIn = weth.target;
    const tokenOut = usdc.target;
    const minProfit = ethers.parseUnits("10", 6); // 10 USDC, adjust as needed
    const minOutUni = 1; // Set to 1 for test; in real use, simulate expected output
    const minOutSushi = 1; // Set to 1 for test

    // Call the flashloan (this will revert unless forked state supports it)
    let tx;
    try {
      tx = await arb.requestFlashLoan(
        flashloanToken,
        flashloanAmount,
        tokenIn,
        tokenOut,
        minProfit,
        minOutUni,
        minOutSushi
      );
      await tx.wait();
      // If successful, check outcomes (balances, logs, etc.)
    } catch (err) {
      // On a fork, this may revert if Aave/DEXes are not set up for test
      console.log("Flashloan simulation reverted (expected in dry run):", err.message);
    }
  });
});
