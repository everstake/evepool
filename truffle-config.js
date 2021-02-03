require('dotenv').config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  // Uncommenting the defaults below 
  // provides for an easier quick-start with Ganache.
  // You can also follow this format for other networks;
  // see <http://truffleframework.com/docs/advanced/configuration>
  // for more details on how to specify configuration options!
  //
  //networks: {
  //  development: {
  //    host: "127.0.0.1",
  //    port: 7545,
  //    network_id: "*"
  //  },
  //  test: {
  //    host: "127.0.0.1",
  //    port: 7545,
  //    network_id: "*"
  //  }
  //}
  //
  networks: {
    ropsten: {
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [process.env.ROPSTEN_PK], 
          providerOrUrl: 'https://ropsten.infura.io/v3/' + process.env.ROPSTEN_INFURA_KEY
          });
      },
      network_id: '3', // eslint-disable-line camelcase
      gas: 4465030,
      gasPrice: 10000000000,
    },
  },

  compilers: {
    solc: {
      version: "^0.6",  
    }
  }
};
