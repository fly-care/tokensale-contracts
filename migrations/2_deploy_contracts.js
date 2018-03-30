const Token = artifacts.require("FlyCareToken");
const TokenSale = artifacts.require("FlyCareTokenSale");
const MultiSigWallet = artifacts.require('MultiSigWallet');
const TimelockVault = artifacts.require('TokenTimelock');

const multiSigWalletMofN = 2;

const tokenEthRate = new web3.BigNumber(3000);

const tokenTotalSupply = 200000000; // 3 hundred million
const tokenSaleTokens = toWei(130000000);

const goalInEth = 5000;
const goalInWei = toWei(goalInEth);

const timelockUntil = 1562025599; // Jun 31, 2019 - 23:59:59 GMT

async function performMigration(deployer, network) {
  
  if (network == "development" || // Truffle develop
      network == "coverage")
  {
    // Test wallet addresses (replace with your local Ganache/TestRPC/... accounts for testing)
    const contrib1 = "0x00eFA85bd0De109420073B66bFA7511869E883F4";
    const contrib2 = "0x009EDF9B153FC82b0945dF55499FfcEa0DE959F8";

    const founder1 = "0x00fF840777cb9819f4b0E2bE6d14Dd23AFbC9302";
    const founder2 = "0x0043C515e8469cc3eCad179DE85BF87b8253e81d";
    const founder3 = "0x00c804C84f0D9F554ac776E02482DE8056240ad5";

    const whitelister = "0x00a329c0648769A73afAc7F9381E08FB43dBEA72";

  } else if (network == "kovan") {

    const contrib1 = "0x000Ec481D3F6e7D7d36aEa84db84EC8De1E71Fb9";
    const contrib2 = "0xD83E198C95bb4a325030c1DD393F2F80D6E7e8E8";

    const founder1 = "0x00fF840777cb9819f4b0E2bE6d14Dd23AFbC9302";
    const founder2 = "0x0043C515e8469cc3eCad179DE85BF87b8253e81d";
    const founder3 = "0x00c804C84f0D9F554ac776E02482DE8056240ad5";

    const whitelister = "0xD83E198C95bb4a325030c1DD393F2F80D6E7e8E8";
  
  
    const founders = [ founder1, founder2, founder3 ];

    const team = [ founder1, founder2, founder3, contrib1, contrib2 ];
    const team_div = [ 200, 200, 200, 200, 200];

    const { timestamp } = await web3.eth.getBlock('latest');
    const startTime = web3.toBigNumber(timestamp  + 120);
    const endTime = web3.toBigNumber(timestamp + 2592000);

    const salePeriods = [1525132800, 1526256000, 1527465600, 1528070400, 1528675200];

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
	whitelister,
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
