const Pool = artifacts.require("Pool");
const Governor = artifacts.require("Governor");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function(deployer) {

  let poolInstance = await Pool.deployed();

  await deployProxy(Governor, [ poolInstance.address ], { deployer });
};
