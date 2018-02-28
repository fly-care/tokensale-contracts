pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/crowdsale/Crowdsale.sol";


/**
 * @title TokenCappedCrowdsale
 * @dev Extension of Crowdsale with a max amount of tokens sold
 */
contract TokenCappedCrowdsale is Crowdsale {
    using SafeMath for uint256;

    uint256 public cap;
    uint256 public tokenSold;

    function TokenCappedCrowdsale(uint256 _cap) public {
        require(_cap > 0);
        cap = _cap;
    }

    // low level token purchase function
    function buyTokens(address beneficiary) public payable {
        require(beneficiary != 0x0);
        require(validPurchase());

        uint256 weiAmount = msg.value;

        // calculate token amount to be created
        uint256 tokens = getTokenAmount(weiAmount);
        require(tokenSold.add(tokens) <= cap);
        
        // update state
        weiRaised = weiRaised.add(weiAmount);
        tokenSold = tokenSold.add(tokens);

        token.mint(beneficiary, tokens);
        TokenPurchase(
            msg.sender,
            beneficiary,
            weiAmount,
            tokens);

        forwardFunds();
    }

    // Override this method to have a way to add business logic to your crowdsale when buying
    function getTokenAmount(uint256 weiAmount) internal view returns(uint256) {
        uint256 _rate = getRate(now);
        return weiAmount.mul(_rate);
    }

    // low level get rate function
    // override to create custom rate function, like giving bonus for early contributors or whitelist addresses
    function getRate(uint256 time) internal view returns (uint256) {
        return rate;
    }

    // overriding Crowdsale#hasEnded to add cap logic
    // @return true if crowdsale event has ended
    function hasEnded() public view returns (bool) {
        bool capReached = tokenSold >= cap;
        return capReached || super.hasEnded();
    }
}