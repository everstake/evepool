require('dotenv').config();
const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const Governor = artifacts.require("Governor");
const DepositContract = artifacts.require("DepositContract");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function(deployer) {
  await deployProxy(PoolToken, [], { deployer });

  const isMainnet = deployer.network.startsWith('mainnet');

  let depositAddress;
  if (isMainnet) {
    depositAddress = "0x00000000219ab540356cBB839Cbe05303d7705Fa";
  } else {
    await deployer.deploy(DepositContract);
    depositAddress = (await DepositContract.deployed()).address;
  }

  // Deploy Pool contract
  let tokenInstance = await PoolToken.deployed();

  await deployProxy(Pool, [ tokenInstance.address, depositAddress, 10 ], { deployer });

  // Deploy Governance contract
  let poolInstance = await Pool.deployed();

  await deployProxy(Governor, [ poolInstance.address ], { deployer });

  // Set ownership
  let governorInstance = await Governor.deployed();

  await tokenInstance.transferOwnership(poolInstance.address);
  await poolInstance.setGovernor(governorInstance.address);

  await poolInstance.setSuperAdmin(process.env.POOL_ADMIN_ADDRESS);
  await tokenInstance.setSuperAdmin(process.env.TOKEN_ADMIN_ADDRESS);
};