const Token = artifacts.require("FlyCareToken");
const TokenSale = artifacts.require("FlyCareTokenSale");
const MultiSigWallet = artifacts.require('MultiSigWallet');
const TimelockVault = artifacts.require('TokenTimelock');

const multiSigWalletMofN = 2;

const tokenEthRate = new web3.BigNumber(1500);

const presaleCap = toWei(32500000); // presale cap 32.5M
const totalTokenSaleCap = toWei(130000000); // total token sale cap 130M

const goalInEth = 1550;
const goalInWei = toWei(goalInEth);

async function performMigration(deployer, network) {
  
  var founder1, founder2, founder3, whitelister; 
  var startTime, endTime, salePeriods;
 
  if (network == "development" || // Truffle develop
      network == "coverage")
  {
    // Test wallet addresses (replace with your local Ganache/TestRPC/... accounts for testing)
    founder1 = "0x00fF840777cb9819f4b0E2bE6d14Dd23AFbC9302";
    founder2 = "0x0043C515e8469cc3eCad179DE85BF87b8253e81d";

    whitelister = "0x00a329c0648769A73afAc7F9381E08FB43dBEA72";

    const { timestamp } = await web3.eth.getBlock('latest');
    startTime = web3.toBigNumber(timestamp  + 120);
    endTime = web3.toBigNumber(timestamp + 2592000);
    salePeriods = [startTime + 86400, startTime + (86400 * 2), startTime + (86400 * 3), startTime + (86400 * 4), endTime];

  } else if (network == "kovan") {
    founder1 = "0x00fF840777cb9819f4b0E2bE6d14Dd23AFbC9302";
    founder2 = "0x0043C515e8469cc3eCad179DE85BF87b8253e81d";

    whitelister = "0xD83E198C95bb4a325030c1DD393F2F80D6E7e8E8";

    const { timestamp } = await web3.eth.getBlock('latest');
    startTime = web3.toBigNumber(timestamp  + 120);
    endTime = web3.toBigNumber(startTime + 432000);
    salePeriods = [startTime + 86400, startTime + (86400 * 2), startTime + (86400 * 3), startTime + (86400 * 4), endTime];

  } else if (network == "mainnet") {
    founder1 = "0x06e486dABC4a42B3e5CBE49cA05D1Fcf794e11Ed"; //Bruno
    founder2 = "0x1Ce5c199B23122690f50137F462790a79a2FF780"; //Dieter

    whitelister = "0x00B60A2C170E86b4a4c3671116a371452579aE42";
    startTime = 1526299200;
    endTime = 1531612799;
    salePeriods = [1527465600, 1528675200, 1529280000, 1529928000, endTime];

  }

    const founders = [ founder1, founder2];

    var multiSigInstance, tokenSaleInstance, tokenAddress;

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
