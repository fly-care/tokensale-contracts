const Token = artifacts.require("FlyCareToken");
const TokenSale = artifacts.require("FlyCareTokenSale");
const MultiSigWallet = artifacts.require('MultiSigWallet');
const TimelockVault = artifacts.require('TokenTimelock');

const multiSigWalletMofN = 2;

const tokenEthRate = new web3.BigNumber(3000);

const tokenTotalSupply = 300000000; // 3 hundred million
const tokenSaleTokens = toWei(195000000);

const goalInEth = 5000;
const goalInWei = toWei(goalInEth);

const timelockUntil = 1562025599; // Jun 31, 2019 - 23:59:59 GMT

async function performMigration(deployer, network) {
  
  if (network == "develop" || // Truffle develop
      network == "coverage")
  {
    // Test wallet addresses (replace with your local Ganache/TestRPC/... accounts for testing)
    const contrib1 = "0xf17f52151EbEF6C7334FAD080c5704D77216b732";
    const contrib2 = "0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef";

    const founder1 = "0x821aEa9a577a9b44299B9c15c88cf3087F3b5544";
    const founder2 = "0x0d1d4e623D10F9FBA5Db95830F7d3839406C6AF2";
    const founder3 = "0x2932b7A2355D6fecc4b5c0B6BD44cC31df247a2e";

    const founders = [ founder1, founder2, founder3 ];

    const team = [ founder1, founder2, founder3, contrib1, contrib2 ];
    const team_div = [ 200, 200, 200, 200, 200];

    const { timestamp } = await web3.eth.getBlock('latest');
    const startTime = web3.toBigNumber(timestamp  + 120);
    const endTime = web3.toBigNumber(timestamp + 2592000);

    const salePeriods = [1523836799, 1525046399, 1526255999, 1527465599];

    var tokenSaleInstance, tokenAddress, unsoldVaultInstance, teamVaultInstances;

    var multiSigInstance, tokenSaleInstance, tokenAddress, unsoldVaultInstance, teamVaultInstances;

    deployer
    .then(function(){
    	// Deploy the MultiSigWallet that will collect the ether
    	return MultiSigWallet.new(
        founders,
        multiSigWalletMofN
      );
    })
    .then(function(wallet_instance){
      console.log("Multisig address: " + wallet_instance.address);
      multiSigInstance = wallet_instance;
      
      // Deploy Token sale contract
      return TokenSale.new(
        startTime,
        endTime,
        tokenEthRate,
        goalInWei,
        tokenSaleTokens,
        multiSigInstance.address,
        salePeriods
      );
    })
    .then(function(instance){
       // Get ERC20 contract address
       tokenSaleInstance = instance;
       console.log('token sale address: ' + tokenSaleInstance.address);
       return tokenSaleInstance.token.call();
    })
    .then(function(address){
       tokenAddress = address;
       console.log('token address: ' + tokenAddress);
      
       // Deploy team token vaults
       var vault_promises = [];
       for (var i=0; i < team.length; i++){
          vault_promises.push(TimelockVault.new(
	          tokenAddress,
            team[i],
	          timelockUntil
	        ));
       }
       return Promise.all(vault_promises);
    })
    .then(function(vault_instances){
      // Set team vaults in token sale
      teamVaultInstances = vault_instances;
      var team_vault_addresses = [];
      for (var i=0; i < vault_instances.length; i++){
        team_vault_addresses.push(vault_instances[i].address);
        console.log('team member '+i+' has vault address: '+vault_instances[i].address);
      }

      var team_vault_set_promises = [];
      for (var j=0; j < team_vault_addresses.length; j++){
        console.log("Will set vault for wallet "+team[j]+" with vault "+team_vault_addresses[j]+ " and div " + team_div[j]);
        team_vault_set_promises.push(
          tokenSaleInstance.setTeamVault(team[j], team_vault_addresses[j], team_div[j])
        );
      }
      return Promise.all(team_vault_set_promises);
    })
    .then(function(team_vault_set_results){
      console.log('Done setting team vaults');
    });
  };
  
};

module.exports = function(deployer, network) {
  deployer
    .then(function() {
      return performMigration(deployer, network);
    })
    .catch(error => {
      console.log(error);
      process.exit(1);
    });
};

function round(value, decimals) {
  return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

function toWei(n) {
  return web3.toBigNumber(web3.toWei(n, 'ether'))
}
