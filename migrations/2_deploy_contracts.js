const Token = artifacts.require("FlyCareToken");
const TokenSale = artifacts.require("FlyCareTokenSale");
const MultiSigWallet = artifacts.require('MultiSigWallet');
const TimelockVault = artifacts.require('TokenTimelock');

const multiSigWalletMofN = 2;

const tokenEthRate = new web3.BigNumber(1500);

const presaleCap = toWei(32500000); // presale cap 32.5M
const totalTokenSaleCap = toWei(130000000); // total token sale cap 130M

const goalInEth = 5000;
const goalInWei = toWei(goalInEth);

const timelockUntil = 1562025599; // Jun 31, 2019 - 23:59:59 GMT

async function performMigration(deployer, network) {
  
  if (network == "development" || // Truffle develop
      network == "coverage")
  {
    // Test wallet addresses (replace with your local Ganache/TestRPC/... accounts for testing)
    const founder1 = "0x00fF840777cb9819f4b0E2bE6d14Dd23AFbC9302";
    const founder2 = "0x0043C515e8469cc3eCad179DE85BF87b8253e81d";
    const founder3 = "0x00c804C84f0D9F554ac776E02482DE8056240ad5";

    const whitelister = "0x00a329c0648769A73afAc7F9381E08FB43dBEA72";

  } else if (network == "kovan") {
    const founder1 = "0x00fF840777cb9819f4b0E2bE6d14Dd23AFbC9302";
    const founder2 = "0x0043C515e8469cc3eCad179DE85BF87b8253e81d";
    const founder3 = "0x00c804C84f0D9F554ac776E02482DE8056240ad5";

    const whitelister = "0xD83E198C95bb4a325030c1DD393F2F80D6E7e8E8";

    const founders = [ founder1, founder2, founder3 ];

    const { timestamp } = await web3.eth.getBlock('latest');
    const startTime = web3.toBigNumber(timestamp  + 120);
    const endTime = web3.toBigNumber(timestamp + 2592000);

    const salePeriods = [1525132800, 1526256000, 1527465600, 1528070400, 1528675200];

    var multiSigInstance, tokenSaleInstance, tokenAddress, unsoldVaultInstance;

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
	presaleCap,
        totalTokenSaleCap,
        multiSigInstance.address,
        salePeriods
      );
    })
    .then(function(instance){
       // Get ERC20 contract address
       tokenSaleInstance = instance;
       console.log('token sale address: ' + tokenSaleInstance.address);
       return tokenSaleInstance.token.call();
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
