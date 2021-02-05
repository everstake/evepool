const DepositContract = artifacts.require("DepositContract");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function(deployer) {
  console.log("Deploying to: " + deployer.network);

  switch (deployer.network) {
    case 'mainnet':
      break;
    default:
      await deployer.deploy(DepositContract);
  }
};
