pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./TokenCappedCrowdsale.sol";
import "./FlyCareToken.sol";


contract FlyCareTokenSale is RefundableCrowdsale, WhitelistedCrowdsale, TokenCappedCrowdsale, MintedCrowdsale, Pausable {
    using SafeMath for uint256;

    // Constants
    uint256 constant public RESERVE_AMOUNT = 70000000 * 10**18; // 50M FCC reserve + 20M FCC team and advisors
    // MAX_TEAM_AMOUNT = 20000000
    // PreSale CAP : 32500000
    // MainSale CAP : 97500000

    uint256 constant public MIN_INVESTMENT = 0.1 * 10**18; // 0.1ETH minimal investment

    // Private
    uint64[5] private salePeriods;

    // Public
    address public whitelister;

    // Events
    event AddToWhitelist(address _beneficiary);

    function FlyCareTokenSale (
        address _whitelister,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _rate,
        uint256 _goal,
        uint256 _presaleCap,
        uint256 _totalTokenSaleCap,
        address _wallet,
        uint64[5] _salePeriods
      ) public
      Crowdsale(_rate, _wallet, new FlyCareToken())
      TokenCappedCrowdsale(_presaleCap, _totalTokenSaleCap, _salePeriods[2])
      TimedCrowdsale(_startTime, _endTime)
      RefundableCrowdsale(_goal)
    {
        require(_goal.mul(_rate) <= _totalTokenSaleCap);
        require(_whitelister != address(0));

        for (uint8 i = 0; i < _salePeriods.length; i++) {
            require(_salePeriods[i] > 0);
        }
        salePeriods = _salePeriods;
        whitelister = _whitelister;
    }

    /**
     * @dev Extend parent behavior requiring the sale not to be paused.
     * @param _beneficiary Token purchaser
     * @param _weiAmount Amount of wei contributed
     */
    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
        require(!paused);
        require(_weiAmount >= MIN_INVESTMENT);
        super._preValidatePurchase(_beneficiary, _weiAmount);
    }

    // descending rate
    function getCurrentRate() public view returns (uint256) {
        uint256 time = now;
        if (time <= salePeriods[0]) {
            return 4031;
        }
        
        if (time <= salePeriods[1]) {
            return 3794;
        }

        if (time <= salePeriods[2]) {
            return 3583;
        }

        if (time <= salePeriods[3]) {
            return 3395;
        }

        if (time <= salePeriods[4]) {
            return 3225;
        }
        return rate;
    }

    /**
     * @dev Overrides parent method taking into account variable rate.
     * @param _weiAmount The value in wei to be converted into tokens
     * @return The number of tokens _weiAmount wei will buy at present time
     */
    function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256) {
        uint256 currentRate = getCurrentRate();
        return currentRate.mul(_weiAmount);
    }

    /**
     * @dev Overrides TimedCrowdsale#hasClosed method to end sale permaturely if token cap has been reached.
     * @return Whether crowdsale has finished
     */
    function hasClosed() public view returns (bool) {
        return tokenCapReached() || super.hasClosed();
    }


    /*******************************************
     * Whitelisting related functions*
     *******************************************/

    /**
     * @dev Change whitelister address to another one if provided by owner
     * @param _whitelister address of the new whitelister
     */

    function setWhitelisterAddress(address _whitelister) external onlyOwner {
        require(_whitelister != address(0));
        whitelister = _whitelister;
    }

    /**
     * @dev Modifier for address whith whitelisting rights
    */
    modifier onlyWhitelister(){
	require(msg.sender == whitelister);
        _;
    }

    /**
     * @dev Overrides addToWhitelist from WhitelistedCrowdsale to use a dedicated address instead of Owner
     * @param _beneficiary Address to be added to the whitelist
     */
    function addToWhitelist(address _beneficiary) external onlyWhitelister {
        whitelist[_beneficiary] = true;
        AddToWhitelist(_beneficiary);
    }

    /**
     * @dev Overrides addToWhitelist from WhitelistedCrowdsale to use a dedicated address instead of Owner
     * @param _beneficiaries Addresses to be added to the whitelist
     */
    function addManyToWhitelist(address[] _beneficiaries) external onlyWhitelister {
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            whitelist[_beneficiaries[i]] = true;
            AddToWhitelist(_beneficiaries[i]);
        }
    }

    /**
     * @dev Overrides addToWhitelist from WhitelistedCrowdsale to use a dedicated address instead of Owner
     * @param _beneficiary Address to be removed to the whitelist
     */
    function removeFromWhitelist(address _beneficiary) external onlyWhitelister {
        whitelist[_beneficiary] = false;
    }

    function finalization() internal {
        if (goalReached()) {
            if (!tokenCapReached()) {
                uint256 tokenUnsold = totalTokenSaleCap.sub(tokenSold);
                // Mint unsold tokens to sale's address & burn them immediately
                _deliverTokens(this, tokenUnsold);
                FlyCareToken(token).burn(tokenUnsold);
            }
          
            // Allocate remaining reserve to multisig wallet
            _deliverTokens(wallet, RESERVE_AMOUNT);

            // Finish token minting & unpause transfers
            require(FlyCareToken(token).finishMinting());
            FlyCareToken(token).unpause();
        }

        super.finalization();
    }

}
