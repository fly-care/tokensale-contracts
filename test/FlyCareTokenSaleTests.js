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
var TimelockVault = artifacts.require("zeppelin-solidity/contracts/token/ERC20/TokenTimelock.sol");

 contract('FlyCareTokenSale', function ([owner, whitelister,
   founder1, founder2, founder3, contrib1, contrib2,
   wallet, purchaser, investor, thirdparty]) {

    const founders = [founder1, founder2, founder3];
    const contribs = [contrib1, contrib2];
    const team = [founder1, founder2, founder3, contrib1, contrib2];
    const whitelisterAddress = whitelister;

    const shareDiv = 200;

    const rate = new BigNumber(3000);
    const deals = [3600,3450,3300,3150];
    const goal = toWei(5000); // in ETH
    const smallAmt = toWei(1);
    const bigAmt = toWei(42);

    const cap = toWei(195000000); // in STAMPS
    const moreThanCap = toWei(195000000 + 1);
    const lessThanCap = toWei(100000000);
    const lessThanGoal = toWei(2000000);
  
    const smallAmtTokens = smallAmt.mul(deals[0]);
    const BigAmtTokens = bigAmt.mul(deals[0]);

    const timelockUntil = latestTime() + duration.weeks(2) + duration.years(1);

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
        this.startTime + duration.days(5)];

      this.crowdsale = await FlyCareTokenSale.new(
        whitelisterAddress,
        this.startTime, this.endTime,
        rate, goal, cap, wallet, this.salePeriods,
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
        await FlyCareTokenSale.new(whitelisterAddress, this.startTime, this.endTime, rate, 0, cap, wallet, this.salePeriods, {from: owner}).should.be.rejectedWith(EVMRevert);
      });

      it('should fail with zero cap', async function () {
        await FlyCareTokenSale.new(whitelisterAddress, this.startTime, this.endTime, rate, goal, 0, wallet, this.salePeriods, {from: owner}).should.be.rejectedWith(EVMRevert);
      });

      it('should fail with goal more than cap', async function () {
        await FlyCareTokenSale.new(whitelisterAddress, this.startTime, this.endTime, rate, moreThanCap, cap, wallet, this.salePeriods, {from: owner}).should.be.rejectedWith(EVMRevert);
      });

      it('should pause the token', async function() {
        let paused = await this.token.paused();
    
        assert.equal(paused, true);
      });

    });

    context('during sale', function() {

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

      it('should log purchase', async function () {
        const {logs} = await this.crowdsale.sendTransaction({value: smallAmt, from: investor});

        const event = logs.find(e => e.event === 'TokenPurchase');

        should.exist(event);
        event.args.purchaser.should.equal(investor);
        event.args.beneficiary.should.equal(investor);
        event.args.value.should.be.bignumber.equal(smallAmt);
        event.args.amount.should.be.bignumber.equal(smallAmtTokens);
      });

      it('should increase totalSupply', async function () {
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor});
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.bignumber.equal(smallAmtTokens);
      });
  
      it('should assign tokens to sender', async function () {
        await this.crowdsale.sendTransaction({value: smallAmt, from: investor});
        let balance = await this.token.balanceOf(investor);
        balance.should.be.bignumber.equal(smallAmtTokens);
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

      it('should accept payments within cap', async function () {
        await this.crowdsale.sendTransaction({value: toWei(54000), from: investor}).should.be.fulfilled;
        await this.crowdsale.sendTransaction({value: toWei(166), from: investor}).should.be.fulfilled;
      });
  
      it('should reject payments outside cap', async function () {
        await this.crowdsale.sendTransaction({value: toWei(54166), from: investor});
        await this.crowdsale.sendTransaction({value: toWei(1), from: investor}).should.be.rejectedWith(EVMRevert);
      });
  
      it('should reject payments that exceed cap', async function () {
        await this.crowdsale.sendTransaction({value: toWei(54167), from: investor}).should.be.rejectedWith(EVMRevert);
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
        await this.crowdsale.sendTransaction({value: toWei(267), from: investor});
        await increaseTimeTo(this.afterEndTime);
    
        await this.crowdsale.finalize({from: owner});
    
        const pre = web3.eth.getBalance(investor);
        await this.crowdsale.claimRefund({from: investor, gasPrice: 0}).should.be.fulfilled;
        const post = web3.eth.getBalance(investor);
    
        post.minus(pre).should.be.bignumber.equal(toWei(267));
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
        await increaseTimeTo(this.startTime);
        let hasClosed = await this.crowdsale.hasClosed();
        hasClosed.should.equal(false);
        await this.crowdsale.sendTransaction({value: toWei(50000), from: investor});
        hasClosed = await this.crowdsale.hasClosed();
        hasClosed.should.equal(false);
      });
  
      it('should not be ended if just under cap', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: toWei(54166), from: investor});
        let hasClosed = await this.crowdsale.hasClosed();
        hasClosed.should.equal(false);
      });
  
      it('should be ended if cap reached', async function () {
        await increaseTimeTo(this.startTime + duration.days(6));
        await this.crowdsale.sendTransaction({value: toWei(65000), from: investor});
        let hasClosed = await this.crowdsale.hasClosed();
        hasClosed.should.equal(true);
      });

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

      beforeEach(async function() {
        // Team member vaults
        for (var i=0; i < team.length; i++) {
          var memberWallet = team[i];
  
          var teamVault = await TimelockVault.new(
            this.tokenAddr,
            memberWallet,
            timelockUntil
          );
          
          var memberTokenShare = shareDiv;
          await this.crowdsale.setTeamVault(memberWallet, teamVault.address, memberTokenShare, {from: owner});
        };
      });

      it('should burn unsold tokens if cap not reached', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor});
        await increaseTimeTo(this.afterEndTime);
        
        await this.crowdsale.finalize({from: owner});

        const saleBalance = await this.token.balanceOf(this.crowdsale.address);
        saleBalance.should.be.bignumber.equal(0);

        // Total Supply should be = sold tokens (= goal * deal 1 in this case) + Reserve amount
        const expectedSupply = toWei(123000000);
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.bignumber.equal(expectedSupply);
      });

      it('should transfer founders token share to 12-month timelock vault', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor})
        await increaseTimeTo(this.afterEndTime);

        await this.crowdsale.finalize({from: owner});

        for (var i = 0; i < founders.length; i++)
        {
          const founder = founders[i];

          const founderVaultAddr = await this.crowdsale.getTeamVault(founder);
          founderVaultAddr.should.not.equal(0x0);
  
          const founderVault = TimelockVault.at(founderVaultAddr);
          should.exist(founderVault);
          
          const vaultBeneficiary = await founderVault.beneficiary();
          vaultBeneficiary.should.equal(founder);
  
          const vaultToken = ERC20Basic.at(await founderVault.token());
          vaultToken.address.should.equal(this.token.address);
  
          const vaultReleaseTime = await founderVault.releaseTime();
          vaultReleaseTime.should.be.bignumber.equal(timelockUntil);
          
          const expectedBalance = web3.fromWei(goal.mul(deals[0]).dividedBy(shareDiv)).round(5);
          const vaultBalance = web3.fromWei(await this.token.balanceOf(founderVaultAddr)).round(5);
          vaultBalance.should.be.bignumber.equal(expectedBalance);
        }
      });

      it('should transfer contributors token share to 12-month timelock vault', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor})
        await increaseTimeTo(this.afterEndTime);

        await this.crowdsale.finalize({from: owner});

        for (var i = 0; i < contribs.length; i++)
        {
          const contrib = contribs[i];

          const contribVaultAddr = await this.crowdsale.getTeamVault(contrib);
          contribVaultAddr.should.not.equal(0x0);
  
          const contribVault = TimelockVault.at(contribVaultAddr);
          should.exist(contribVault);
          
          const vaultBeneficiary = await contribVault.beneficiary();
          vaultBeneficiary.should.equal(contrib);
  
          const vaultToken = ERC20Basic.at(await contribVault.token());
          vaultToken.address.should.equal(this.token.address);
  
          const vaultReleaseTime = await contribVault.releaseTime();
          vaultReleaseTime.should.be.bignumber.equal(timelockUntil);
          
          const expectedBalance = web3.fromWei(goal.mul(deals[0]).dividedBy(shareDiv)).round(5);
          const vaultBalance = web3.fromWei(await this.token.balanceOf(contribVaultAddr)).round(5);
          vaultBalance.should.be.bignumber.equal(expectedBalance);
        }
      });

      it('should transfer reserved tokens to org wallet (minus founders & contributors shares)', async function () {
        await increaseTimeTo(this.startTime);
        await this.crowdsale.sendTransaction({value: goal, from: investor})
        await increaseTimeTo(this.afterEndTime);

        await this.crowdsale.finalize({from: owner});

        const soldTokens = goal.mul(deals[0]);
        const founderShares = soldTokens.dividedBy(shareDiv).times(founders.length);
        const contributorShares = soldTokens.dividedBy(shareDiv).times(contribs.length);

        var reserve = await this.crowdsale.RESERVE_AMOUNT();
        reserve = web3.fromWei(reserve.minus(founderShares).minus(contributorShares)).round(5);

        const balance = web3.fromWei(await this.token.balanceOf(wallet)).round(5);
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
