const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const Governor = artifacts.require("Governor");
const DepositContract = artifacts.require("DepositContract");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function(deployer) {

  await deployProxy(PoolToken, [], { deployer });
  let tokenInstance = await PoolToken.deployed();
  
  let depositAddress;

  switch (deployer.network) {
    case 'goerli':
      depositAddress = "0x8c5fecdc472e27bc447696f431e425d02dd46a8c";
      break;
    case 'mainnet':
      depositAddress = "0x00000000219ab540356cBB839Cbe05303d7705Fa";
      break;
    default:
      await deployer.deploy(DepositContract);
      depositAddress = (await DepositContract.deployed()).address;
  }

  await deployProxy(Pool, [ tokenInstance.address, depositAddress, 10 ], { deployer });
  let poolInstance = await Pool.deployed();

  await deployProxy(Governor, [ poolInstance.address ], { deployer });
  let governorInstance = await Governor.deployed();

  tokenInstance.transferOwnership(poolInstance.address);
  poolInstance.setGovernor(governorInstance.address);
};
