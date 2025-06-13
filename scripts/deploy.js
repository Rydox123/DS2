const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with:", deployer.address);

  const addressesProvider = process.env.AAVE_ADDRESSES_PROVIDER;
  const uniRouter = process.env.UNISWAP_V2_ROUTER;
  const sushiRouter = process.env.SUSHISWAP_ROUTER;

  const FlashloanArb = await hre.ethers.deployContract(
    "FlashloanArb",
    [
      addressesProvider,
      uniRouter,
      sushiRouter,
      deployer.address // initialOwner for Ownable
    ]
  );

  await FlashloanArb.waitForDeployment();

  const deployedAddress = await FlashloanArb.getAddress();
  console.log("FlashloanArb deployed at:", deployedAddress);

  // Save to JSON file
  const network = hre.network.name;
  const savePath = path.join(__dirname, "..", "deployed_addresses.json");
  let deployed = {};
  if (fs.existsSync(savePath)) {
    deployed = JSON.parse(fs.readFileSync(savePath, "utf8"));
  }
  deployed[network] = {
    contract: deployedAddress,
    aaveProvider: addressesProvider,
    uniswapV2Router: uniRouter,
    sushiswapRouter: sushiRouter
  };
  fs.writeFileSync(savePath, JSON.stringify(deployed, null, 2));
  console.log(`Saved deployment info to ${savePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
