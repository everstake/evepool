const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const Governor = artifacts.require("Governor");
const DepositContract = artifacts.require("DepositContract");

module.exports = async function(deployer) {

  await deployer.deploy(PoolToken);
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

  await deployer.deploy(Pool, tokenInstance.address, depositAddress, 10);
  let poolInstance = await Pool.deployed();

  await deployer.deploy(Governor, poolInstance.address);
  let governorInstance = await Governor.deployed();

  tokenInstance.transferOwnership(poolInstance.address);
  poolInstance.setGovernor(governorInstance.address);
};
