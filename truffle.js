require('babel-register')({
  ignore: /node_modules\/(?!zeppelin-solidity)/
});
require('babel-polyfill');

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*" // Match any network id
    },
    kovan: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
      from: "0xD83E198C95bb4a325030c1DD393F2F80D6E7e8E8",
      gas: 6000000
    },
    mainnet: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1", // Match any network id
      from: "0xe185cD15556D14a8bA2111Df1d0745C164E801AA",
      gas: 4900000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
