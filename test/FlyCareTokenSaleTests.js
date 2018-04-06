import toWei from 'zeppelin-solidity/test/helpers/ether';
import {advanceBlock} from 'zeppelin-solidity/test/helpers/advanceToBlock';
import {increaseTimeTo, duration} from 'zeppelin-solidity/test/helpers/increaseTime';
import latestTime from 'zeppelin-solidity/test/helpers/latestTime';
import EVMThrow from 'zeppelin-solidity/test/helpers/EVMThrow';
import EVMRevert from './helpers/EVMRevert';

const assertJump = require('zeppelin-solidity/test/helpers/assertJump');

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

var FlyCareToken = artifacts.require("./FlyCareToken.sol");
var FlyCareTokenSale = artifacts.require("./FlyCareTokenSale.sol");
var ERC20Basic = artifacts.require("zeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol");

 contract('FlyCareTokenSale', function ([owner, whitelister,
   wallet, purchaser, investor, thirdparty]) {

    const whitelisterAddress = whitelister;

    const shareDiv = 200;

    const rate = new BigNumber(1500);
    const deals = [1875, 1765, 1667, 1579, 1500];

    // Amounts in ETH
    const goalETH = 5000;
    const goal = toWei(goalETH); // in ETH
    const moreThanGoal = toWei(goalETH + 1);
    const lessThanGoal = toWei(goalETH -1);
    const smallAmt = toWei(1);
    const bigAmt = toWei(42);
    const minInvestment = toWei(0.1);
    const lessThanMinInvestment = toWei(0.09); 
    // Computed for deals = [1875, 1765, 1667, 1579, 1500]
    const ETHLessThanPresaleCap = toWei(17300); // Valid during sale period 1
    const ETHMoreThanPresaleCap = toWei(17500); // Valid during sale period 1
    const ETHLessThanCap = toWei(86600); // Valid during sale period 5
    const ETHMoreThanCap = toWei(86700); // Valid during sale period 5

    // Amounts in FCC
    const presaleCap = toWei(32500000); // in FCC
    const totalTokenSaleCap = toWei(130000000); // in FCC
    const moreThanPresaleCap = toWei(32500000 + 1);
    const moreThanCap = totalTokenSaleCap + 1;
    const lessThanPresaleCap = presaleCap - 1;
    const lessThanCap = totalTokenSaleCap - 1;
  
    const smallAmtTokensPresale = smallAmt.mul(deals[0]);
    const smallAmtTokensSale = smallAmt.mul(deals[4]);
    const BigAmtTokensPresale = bigAmt.mul(deals[0]);
    const BigAmtTokensSale = bigAmt.mul(deals[4]);
    

    before(async function() {
        //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock();
    });

    beforeEach(async function () {
      this.startTime = latestTime() + duration.weeks(1);
      this.endTime =   this.startTime + duration.weeks(1);
      this.afterEndTime = this.endTime + duration.seconds(1);

      this.salePeriods = [
        this.startTime + duration.days(1),
        this.startTime + duration.days(2),
        this.startTime + duration.days(3),
        this.startTime + duration.days(4),
        this.startTime + duration.days(5),
      ];

      this.crowdsale = await FlyCareTokenSale.new(
        whitelisterAddress,
        this.startTime, this.endTime,
        rate, goal, presaleCap, totalTokenSaleCap, wallet, this.salePeriods,
        {from: owner, gas: 6000000 }
      );
      
      this.tokenAddr = await this.crowdsale.token();
      this.token = FlyCareToken.at(this.tokenAddr);

      // Add investor to whitelist
      await this.crowdsale.addToWhitelist(investor, {from: whitelisterAddress});
    });

    context('before sale', function() {
        
      it('should be token owner', async function () {
        const owner = await this.token.owner();
        owner.should.equal(this.crowdsale.address);
      });

      it('should reject payments before start', async function () {
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor}).should.be.rejectedWith(EVMRevert);
        await this.crowdsale.buyTokens(investor, {from: purchaser, value: smallAmt}).should.be.rejectedWith(EVMRevert);
      });

      it('should fail with zero goal', async function () {
        await FlyCareTokenSale.new(whitelisterAddress, this.startTime, this.endTime, rate, 0, presaleCap, totalTokenSaleCap, wallet, this.salePeriods, {from: owner}).should.be.rejectedWith(EVMRevert);
      });

      it('should fail with zero total cap', async function () {
        await FlyCareTokenSale.new(whitelisterAddress, this.startTime, this.endTime, rate, goal, presaleCap, 0, wallet, this.salePeriods, {from: owner}).should.be.rejectedWith(EVMRevert);
      });

      it('shoulSupplyMintedzero presale cap', async function () {
        await FlyCareTokenSale.new(whitelisterAddress, this.startTime, this.endTime, rate, goal, 0, totalTokenSaleCap, wallet, this.salePeriods, {from: owner}).should.be.rejectedWith(EVMRevert);
      });

      it('should fail with goal more than total cap', async function () {
        await FlyCareTokenSale.new(whitelisterAddress, this.startTime, this.endTime, rate, ETHMoreThanCap, presaleCap, totalTokenSaleCap, wallet, this.salePeriods, {from: owner}).should.be.rejectedWith(EVMRevert);
      });

      it('should pause the token', async function() {
        let paused = await this.token.paused();
    
        assert.equal(paused, true);
      });

    });


    context('during presale', function() {

      beforeEach(async function() {
        await increaseTimeTo(this.startTime + duration.minutes(2));
      });

      it('should accept payments after start if whitelisted', async function () {
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor}).should.be.fulfilled;
        await this.crowdsale.buyTokens(investor, {value: smallAmt, from: purchaser}).should.be.fulfilled;
      });

      it('should reject payments after start if not whitelisted', async function () {
        // Remove investor from whitelist
        await this.crowdsale.removeFromWhitelist(investor, {from: whitelisterAddress});

        await this.crowdsale.sendTransaction({value: smallAmt, from: investor}).should.be.rejectedWith(EVMRevert);
        await this.crowdsale.buyTokens(investor, {value: smallAmt, from: purchaser}).should.be.rejectedWith(EVMRevert);

        // Also try with owner just to prove the point
        await this.crowdsale.send(smallAmt).should.be.rejectedWith(EVMRevert);
      });

      it('should accept payments equal to the minimum investment', async function () {
        await this.crowdsale.sendTransaction({value: minInvestment, from: investor}).should.be.fulfilled;
        await this.crowdsale.buyTokens(investor, {value: minInvestment, from: purchaser}).should.be.fulfilled;
      });

      it('should reject payments below the minimum investment', async function () {
        await this.crowdsale.sendTransaction({value: lessThanMinInvestment, from: investor}).should.be.rejectedWith(EVMRevert);
        await this.crowdsale.buyTokens(investor, {value: lessThanMinInvestment, from: purchaser}).should.be.rejectedWith(EVMRevert);
      });

      it('should log purchase', async function () {
        const {logs} = await this.crowdsale.sendTransaction({value: smallAmt, from: investor});

        const event = logs.find(e => e.event === 'TokenPurchase');

        should.exist(event);
        event.args.purchaser.should.equal(investor);
        event.args.beneficiary.should.equal(investor);
        event.args.value.should.be.bignumber.equal(smallAmt);
        event.args.amount.should.be.bignumber.equal(smallAmtTokensPresale);
      });

      it('should increase totalSupply', async function () {
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor});
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.bignumber.equal(smallAmtTokensPresale);
      });
  
      it('should assign tokens to sender', async function () {
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor});
        let balance = await this.token.balanceOf(investor);
        balance.should.be.bignumber.equal(smallAmtTokensPresale);
      });
  
      it('should not forward funds to wallet before end', async function () {
        const pre = web3.eth.getBalance(wallet);
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor});
        const post = web3.eth.getBalance(wallet);
        post.should.be.bignumber.equal(pre);
      });

      it('should deny refunds before end', async function () {
        await this.crowdsale.claimRefund({from: investor}).should.be.rejectedWith(EVMRevert);
      });

      it('should accept payments within presale cap', async function () {
        await this.crowdsale.sendTransaction({value: ETHLessThanPresaleCap, from: investor}).should.be.fulfilled;
        await this.crowdsale.sendTransaction({value: toWei(1), from: investor}).should.be.fulfilled;
      });
  
      it('should reject payments outside presale cap', async function () {
        await this.crowdsale.sendTransaction({value: ETHLessThanPresaleCap, from: investor});
        await this.crowdsale.sendTransaction({value: toWei(100), from: investor}).should.be.rejectedWith(EVMRevert);
      });
  
      it('should reject payments that exceed presale cap', async function () {
        await this.crowdsale.sendTransaction({value: ETHMoreThanPresaleCap, from: investor}).should.be.rejectedWith(EVMRevert);
      });

      it('cannot be finalized before ending', async function () {
        await this.crowdsale.finalize({from: owner}).should.be.rejectedWith(EVMRevert);
      });

      it('should pause the token', async function() {
        let paused = await this.token.paused();
    
        assert.equal(paused, true);
      });

    });

    context('during sale', function() {

      beforeEach(async function() {
        await increaseTimeTo(this.startTime + duration.days(5) + duration.minutes(2));
      });

      it('should accept payments after start if whitelisted', async function () {
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor}).should.be.fulfilled;
        await this.crowdsale.buyTokens(investor, {value: smallAmt, from: purchaser}).should.be.fulfilled;
      });

      it('should reject payments after start if not whitelisted', async function () {
        // Remove investor from whitelist
        await this.crowdsale.removeFromWhitelist(investor, {from: whitelisterAddress});

        await this.crowdsale.sendTransaction({value: smallAmt, from: investor}).should.be.rejectedWith(EVMRevert);
        await this.crowdsale.buyTokens(investor, {value: smallAmt, from: purchaser}).should.be.rejectedWith(EVMRevert);

        // Also try with owner just to prove the point
        await this.crowdsale.send(smallAmt).should.be.rejectedWith(EVMRevert);
      });

      it('should accept payments equal to the minimum investment', async function () {
        await this.crowdsale.sendTransaction({value: minInvestment, from: investor}).should.be.fulfilled;
        await this.crowdsale.buyTokens(investor, {value: minInvestment, from: purchaser}).should.be.fulfilled;
      });

      it('should reject payments below the minimum investment', async function () {
        await this.crowdsale.sendTransaction({value: lessThanMinInvestment, from: investor}).should.be.rejectedWith(EVMRevert);
        await this.crowdsale.buyTokens(investor, {value: lessThanMinInvestment, from: purchaser}).should.be.rejectedWith(EVMRevert);
      });

      it('should log purchase', async function () {
        const {logs} = await this.crowdsale.sendTransaction({value: smallAmt, from: investor});

        const event = logs.find(e => e.event === 'TokenPurchase');

        should.exist(event);
        event.args.purchaser.should.equal(investor);
        event.args.beneficiary.should.equal(investor);
        event.args.value.should.be.bignumber.equal(smallAmt);
        event.args.amount.should.be.bignumber.equal(smallAmtTokensSale);
      });

      it('should increase totalSupply', async function () {
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor});
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.bignumber.equal(smallAmtTokensSale);
      });
  
      it('should assign tokens to sender', async function () {
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor});
        let balance = await this.token.balanceOf(investor);
        balance.should.be.bignumber.equal(smallAmtTokensSale);
      });
  
      it('should not forward funds to wallet before end', async function () {
        const pre = web3.eth.getBalance(wallet);
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor});
        const post = web3.eth.getBalance(wallet);
        post.should.be.bignumber.equal(pre);
      });

      it('should deny refunds before end', async function () {
        await this.crowdsale.claimRefund({from: investor}).should.be.rejectedWith(EVMRevert);
      });

      it('should accept payments within total cap', async function () {
        await this.crowdsale.sendTransaction({value: ETHLessThanCap, from: investor}).should.be.fulfilled;
        await this.crowdsale.sendTransaction({value: toWei(1), from: investor}).should.be.fulfilled;
      });
  
      it('should reject payments outside cap', async function () {
        await this.crowdsale.sendTransaction({value: ETHLessThanCap, from: investor});
        await this.crowdsale.sendTransaction({value: toWei(200), from: investor}).should.be.rejectedWith(EVMRevert);
      });
  
      it('should reject payments that exceed cap', async function () {
        await this.crowdsale.sendTransaction({value: ETHMoreThanCap, from: investor}).should.be.rejectedWith(EVMRevert);
      });

      it('cannot be finalized before ending', async function () {
        await this.crowdsale.finalize({from: owner}).should.be.rejectedWith(EVMRevert);
      });

      it('should pause the token', async function() {
        let paused = await this.token.paused();
    
        assert.equal(paused, true);
      });

    });

    context('paused', function() {
      beforeEach(async function() {
        await increaseTimeTo(this.startTime + duration.minutes(2));
      });

      it('should reject payments when paused', async function () {
        this.crowdsale.pause({from: owner});

        await this.crowdsale.sendTransaction({value: smallAmt, from: investor}).should.be.rejectedWith(EVMRevert);
        await this.crowdsale.buyTokens(investor, {from: purchaser, value: smallAmt}).should.be.rejectedWith(EVMRevert);
      });

      it('should re-accept payments when paused then unpaused', async function () {
        this.crowdsale.pause({from: owner});
        await advanceBlock();
        this.crowdsale.unpause({from: owner});

        await this.crowdsale.sendTransaction({value: smallAmt, from: investor}).should.be.fulfilled;
        await this.crowdsale.buyTokens(investor, {value: smallAmt, from: purchaser}).should.be.fulfilled;
      });

    });

    context('after sale', function() {

      it('should be ended only after end', async function () {
        let ended = await this.crowdsale.hasClosed();
        ended.should.equal(false);
        await increaseTimeTo(this.afterEndTime);
        ended = await this.crowdsale.hasClosed();
        ended.should.equal(true);
      });

      it('should reject payments after end', async function () {
        await increaseTimeTo(this.afterEndTime);
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor}).should.be.rejectedWith(EVMRevert);
        await this.crowdsale.buyTokens(investor, {value: smallAmt, from: purchaser}).should.be.rejectedWith(EVMRevert);
      });

      it('should deny refunds after end if goal was reached', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor});
        await increaseTimeTo(this.afterEndTime);
        await this.crowdsale.claimRefund({from: investor}).should.be.rejectedWith(EVMRevert);
      });

      it('should allow refunds after end if goal was not reached', async function () {
        await increaseTimeTo(this.startTime);
        const pre = web3.eth.getBalance(investor);
        await this.crowdsale.sendTransaction({value: lessThanGoal, from: investor, gasPrice: 0});
        await increaseTimeTo(this.afterEndTime);
    
        await this.crowdsale.finalize({from: owner});
    
        await this.crowdsale.claimRefund({from: investor, gasPrice: 0}).should.be.fulfilled;
        const post = web3.eth.getBalance(investor);
    
        post.should.be.bignumber.equal(pre);
      });

      it('should forward funds to wallet after end if goal was reached', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor})
        await increaseTimeTo(this.afterEndTime);
    
        const pre = web3.eth.getBalance(wallet);
        await this.crowdsale.finalize({from: owner});
        const post = web3.eth.getBalance(wallet);
    
        post.minus(pre).should.be.bignumber.equal(goal);
      });

      it('should not be ended if under cap', async function () {
        await increaseTimeTo(this.startTime + duration.days(5) + duration.minutes(2));
        let hasClosed = await this.crowdsale.hasClosed();
        hasClosed.should.equal(false);
        await this.crowdsale.sendTransaction({value: ETHLessThanCap, from: investor});
        hasClosed = await this.crowdsale.hasClosed();
        hasClosed.should.equal(false);
      });
  
      /*
      it('should be ended if cap reached', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: , from: investor});
        let hasClosed = await this.crowdsale.hasClosed();
        hasClosed.should.equal(true);
      }); */

      it('cannot be finalized by third party after ending', async function () {
        await increaseTimeTo(this.afterEndTime);
        await this.crowdsale.finalize({from: thirdparty}).should.be.rejectedWith(EVMRevert);
      });
    
      it('can be finalized by owner after ending', async function () {
        await increaseTimeTo(this.afterEndTime);
        await this.crowdsale.finalize({from: owner}).should.be.fulfilled;
      });
    
      it('cannot be finalized twice', async function () {
        await increaseTimeTo(this.afterEndTime);
        await this.crowdsale.finalize({from: owner});
        await this.crowdsale.finalize({from: owner}).should.be.rejectedWith(EVMRevert);
      });
    
      it('logs finalized', async function () {
        await increaseTimeTo(this.afterEndTime);
        const {logs} = await this.crowdsale.finalize({from: owner});
        const event = logs.find(e => e.event === 'Finalized');
        should.exist(event);
      });

      it('should pause the token', async function() {
        await increaseTimeTo(this.afterEndTime);
        let paused = await this.token.paused();
    
        assert.equal(paused, true);
      });

    });

    context('sale finalization w/ goal reached', function() {

      it('should burn unsold tokens if cap not reached', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor});
        await increaseTimeTo(this.afterEndTime);
        
        await this.crowdsale.finalize({from: owner});

        const saleBalance = await this.token.balanceOf(this.crowdsale.address);
        saleBalance.should.be.bignumber.equal(0);

        // Total Supply should be tokenSold + reserve amount
	var tokenSold = await this.crowdsale.tokenSold();
        var reserve = await this.crowdsale.RESERVE_AMOUNT();
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.bignumber.equal(tokenSold.add(reserve));
      });

      it('should transfer reserved tokens to org wallet', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor})
        await increaseTimeTo(this.afterEndTime);

        await this.crowdsale.finalize({from: owner});

        const soldTokens = goal.mul(deals[0]);

        var reserve = await this.crowdsale.RESERVE_AMOUNT();

        const balance = await this.token.balanceOf(wallet);
        balance.should.be.bignumber.equal(reserve);
      });

      it('should finish token minting', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor})
        await increaseTimeTo(this.afterEndTime);

        await this.crowdsale.finalize({from: owner});
        const tokenMintingFinished = await this.token.mintingFinished();
        
        tokenMintingFinished.should.equal(true);
      });

      it('should unpause the token', async function() {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor})
        await increaseTimeTo(this.afterEndTime);

        await this.crowdsale.finalize({from: owner});
        let paused = await this.token.paused();
    
        assert.equal(paused, false);
      });

    });

    context('sale ownership', function() {

      it('should have an owner', async function() {
        const saleOwner = await this.crowdsale.owner();
        saleOwner.should.equal(owner);
      });
    
      it('changes owner after transfer', async function() {
        await this.crowdsale.transferOwnership(thirdparty, {from: owner});
        const saleOwner = await this.crowdsale.owner();
    
        saleOwner.should.equal(thirdparty);
      });
    
      it('should prevent non-owners from transfering', async function() {
        const saleOwner = await this.crowdsale.owner.call();
        assert.isTrue(saleOwner !== thirdparty);
        await this.crowdsale.transferOwnership(thirdparty, {from: thirdparty}).should.be.rejectedWith(EVMRevert);
      });
    
      it('should guard ownership against stuck state', async function() {
        let saleOwner = await this.crowdsale.owner();
        await this.crowdsale.transferOwnership(null, {from: saleOwner}).should.be.rejectedWith(EVMRevert);
      });    
    });

});
