pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/crowdsale/Crowdsale.sol";


/**
 * @title TokenCappedCrowdsale
 * @dev Extension of Crowdsale with a max amount of tokens sold
 */
contract TokenCappedCrowdsale is Crowdsale {
    using SafeMath for uint256;

    uint256 public tokenCap;
    uint256 public tokenSold;

    /**
     * @dev Constructor, takes maximum number of tokens to be minted by the crowdsale.
     * @param _tokenCap Max number of tokens to be minted
     */
    function TokenCappedCrowdsale(uint256 _tokenCap) public {
      require(_tokenCap > 0);
      tokenCap = _tokenCap;
    }

    /**
     * @dev Checks whether the cap has been reached. 
     * @return Whether the cap was reached
     */
    function tokenCapReached() public view returns (bool) {
      return tokenSold >= tokenCap;
    }

    /**
     * @dev Extend parent behavior requiring purchase to respect the minting cap.
     * @param _beneficiary Token purchaser
     * @param _weiAmount Amount of wei contributed
     */
    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
        super._preValidatePurchase(_beneficiary, _weiAmount);
        // calculate token amount to be created
        uint256 tokenAmount = _getTokenAmount(_weiAmount);
        require(tokenSold.add(tokenAmount) <= tokenCap);
    }

    /**
     * @dev Extend parent behavior updating the number of token sold.
     * @param _beneficiary Address receiving the tokens
     * @param _tokenAmount Number of tokens to be purchased
     */
    function _processPurchase(address _beneficiary, uint256 _tokenAmount) internal {
        super._processPurchase(_beneficiary, _tokenAmount);
        // update state
        tokenSold = tokenSold.add(_tokenAmount);
    }

}