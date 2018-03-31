pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/crowdsale/Crowdsale.sol";


/**
 * @title TokenCappedCrowdsale
 * @dev Extension of Crowdsale with a max amount of tokens sold
 */
contract TokenCappedCrowdsale is Crowdsale {
    using SafeMath for uint256;

    uint256 public tokenSold;
    uint256 public tokenPresaleCap;
    uint256 public tokenPresaleSold;
    uint256 public saleStartTime;
    uint256 public totalTokenSaleCap;

    /**
     * @dev Constructor, takes presal cap, maximum number of tokens to be minted by the crowdsale and start date of regular sale period.
     * @param _tokenPresaleCap Max number of tokens to be sold during presale
     * @param _totalTokenSaleCap Max number of tokens to be minted
     * @param _saleStartTime Start date of the sale period
     */
    function TokenCappedCrowdsale(uint256 _tokenPresaleCap, uint256 _totalTokenSaleCap, uint256 _saleStartTime) public {
      require(_tokenPresaleCap > 0);
      require(_totalTokenSaleCap > 0);
      tokenPresaleCap = _tokenPresaleCap;
      saleStartTime = _saleStartTime;
      totalTokenSaleCap = _totalTokenSaleCap;
    }

    /**
     * @dev Checks whether the cap has been reached. 
     * @return Whether the cap was reached
     */
    function tokenCapReached() public view returns (bool) {
      return tokenSold >= totalTokenSaleCap;
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
        // Enforce presale cap before the begining of the sale
	if (block.timestamp < saleStartTime) {
            require(tokenPresaleSold.add(tokenAmount) <= tokenPresaleCap);
        } else {
        // Enfore total (presale + sale) token cap once the sale has started
            require(tokenSold.add(tokenAmount) <= totalTokenSaleCap);
        }
    }

    /**
     * @dev Extend parent behavior updating the number of token sold.
     * @param _beneficiary Address receiving the tokens
     * @param _tokenAmount Number of tokens to be purchased
     */
    function _processPurchase(address _beneficiary, uint256 _tokenAmount) internal {
        super._processPurchase(_beneficiary, _tokenAmount);
        // update state
        // Keep track of all token sold in tokenSold
        tokenSold = tokenSold.add(_tokenAmount);
        // During presale only, keep track of token sold in tokenPresaleSold
        if (block.timestamp < saleStartTime) {
            tokenPresaleSold = tokenPresaleSold.add(_tokenAmount);
        }
    }

}
