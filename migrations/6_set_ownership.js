const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const Governor = artifacts.require("Governor");

module.exports = async function(deployer) {

  let tokenInstance = await PoolToken.deployed();
  let poolInstance = await Pool.deployed();
  let governorInstance = await Governor.deployed();

  await tokenInstance.transferOwnership(poolInstance.address);
  await poolInstance.setGovernor(governorInstance.address);

  // Replace with actual super admin address
  await poolInstance.setSuperAdmin("0x0000000000000000000000000000000000000000");
  await tokenInstance.setSuperAdmin("0x0000000000000000000000000000000000000000");
};
