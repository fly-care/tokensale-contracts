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
    uint256 constant public RESERVE_AMOUNT = 105000000 * 10**18; // 105M FCC
    // MAX_TEAM_AMOUNT = 75000000
    // PreSale CAP : 75000000
    // MainSale CAP : 120000000

    // Data types
    struct TeamMember {
        address wallet; // Address of team member's wallet
        address vault;   // Address of token timelock vault
        uint64 shareDiv; // Divisor to be used to get member's token share
    }
    
    // Private
    uint64[4] private salePeriods;
    uint8 private numTeamMembers;
    mapping (uint => address) private memberLookup;

    // Public
    mapping (address => TeamMember) public teamMembers;  // founders & contributors vaults (beneficiary,vault) + Org's multisig

    function FlyCareTokenSale (
        uint256 _startTime,
        uint256 _endTime,
        uint256 _rate,
        uint256 _goal,
        uint256 _cap,
        address _wallet,
        uint64[4] _salePeriods
      ) public
      Crowdsale(_rate, _wallet, new FlyCareToken())
      TokenCappedCrowdsale(_cap)
      TimedCrowdsale(_startTime, _endTime)
      RefundableCrowdsale(_goal)
    {
        require(_goal.mul(_rate) <= _cap);

        for (uint8 i = 0; i < _salePeriods.length; i++) {
            require(_salePeriods[i] > 0);
        }
        salePeriods = _salePeriods;
    }

    /**
     * @dev Extend parent behavior requiring the sale not to be paused.
     * @param _beneficiary Token purchaser
     * @param _weiAmount Amount of wei contributed
     */
    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
        require(!paused);
        super._preValidatePurchase(_beneficiary, _weiAmount);
    }

    // descending rate
    function getCurrentRate() public view returns (uint256) {
        uint256 time = now;
        if (time <= salePeriods[0]) {
            return 3600;
        }
        
        if (time <= salePeriods[1]) {
            return 3450;
        }

        if (time <= salePeriods[2]) {
            return 3300;
        }

        if (time <= salePeriods[3]) {
            return 3150;
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

    function setTeamVault(address _wallet, address _vault, uint64 _shareDiv) onlyOwner public returns (bool) {
        require(now < openingTime); // Only before sale starts !
        require(_wallet != address(0));
        require(_vault != address(0));
        require(_shareDiv > 0);

        require(numTeamMembers + 1 < 8);

        memberLookup[numTeamMembers] = _wallet;
        teamMembers[_wallet] = TeamMember(_wallet, _vault, _shareDiv);
        numTeamMembers++;

        return true;
    }

    function getTeamVault(address _wallet) constant public returns (address) {
        require(_wallet != address(0));
        return teamMembers[_wallet].vault;
    }

    function finalization() internal {
        if (goalReached()) {
            bool capReached = tokenSold >= tokenCap;
            if (!capReached) {
                uint256 tokenUnsold = tokenCap.sub(tokenSold);
                // Mint unsold tokens to sale's address & burn them immediately
                _deliverTokens(this, tokenUnsold);
                FlyCareToken(token).burn(tokenUnsold);
            }
          
            uint256 tokenReserved = RESERVE_AMOUNT;
          
            for (uint8 i = 0; i < numTeamMembers; i++) {
                TeamMember memory member = teamMembers[memberLookup[i]];
                if (member.vault != address(0)) {
                    var tokenAmount = tokenSold.div(member.shareDiv);
                    _deliverTokens(member.vault, tokenAmount);
                    tokenReserved = tokenReserved.sub(tokenAmount);
                }
            }

            // Allocate remaining reserve to multisig wallet
            _deliverTokens(wallet, tokenReserved);

            // Finish token minting & unpause transfers
            require(FlyCareToken(token).finishMinting());
            FlyCareToken(token).unpause();
        }

        super.finalization();
    }

}
