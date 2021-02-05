const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const Governor = artifacts.require("Governor");
const DepositContract = artifacts.require("DepositContract");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function(deployer) {

  let tokenInstance = await PoolToken.deployed();
  
  let depositAddress;

  switch (deployer.network) {
    case 'mainnet':
      depositAddress = "0x00000000219ab540356cBB839Cbe05303d7705Fa";
      break;
    default:
      depositAddress = (await DepositContract.deployed()).address;
  }

  await deployProxy(Pool, [ tokenInstance.address, depositAddress, 10 ], { deployer });
};
