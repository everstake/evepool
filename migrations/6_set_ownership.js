const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const Governor = artifacts.require("Governor");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function(deployer) {

  let tokenInstance = await PoolToken.deployed();
  let poolInstance = await Pool.deployed();
  let governorInstance = await Governor.deployed();

  tokenInstance.transferOwnership(poolInstance.address);
  poolInstance.setGovernor(governorInstance.address);
};
