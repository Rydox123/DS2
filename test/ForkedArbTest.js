const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Forked Mainnet Test', function () {
  let arb, weth, usdc, owner;

  before(async function () {
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: process.env.ETH_RPC_URL,
          blockNumber: 18934500
        }
      }]
    });

    [owner] = await ethers.getSigners();
    weth = await ethers.getContractAt('IERC20', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
    usdc = await ethers.getContractAt('IERC20', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');

    const FlashloanArb = await ethers.getContractFactory('FlashloanArb');
    arb = await FlashloanArb.deploy(
      process.env.AAVE_ADDRESSES_PROVIDER,
      process.env.UNISWAP_V2_ROUTER,
      process.env.SUSHISWAP_ROUTER,
      owner.address
    );
    await arb.waitForDeployment();

    await owner.sendTransaction({to: arb.target, value: ethers.parseEther('0.1')});
  });

  it('Executes WETH/USDC arbitrage', async function () {
    const loanAmount = ethers.parseEther('50');
    const minProfit = ethers.parseEther('0.15');
    await arb.requestFlashLoan(
  weth.target,           // token
  loanAmount,            // amount
  weth.target,           // tokenIn
  usdc.target,           // tokenOut
  minProfit,             // minProfit
  1,                     // minOutUni (set to 1 for test)
  1                      // minOutSushi (set to 1 for test)
);
    const profit = await weth.balanceOf(arb.target);
    expect(profit).to.be.gt(minProfit);
  });
});
