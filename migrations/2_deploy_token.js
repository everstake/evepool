const PoolToken = artifacts.require("PoolToken");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function(deployer) {
  await deployProxy(PoolToken, [], { deployer });
};
