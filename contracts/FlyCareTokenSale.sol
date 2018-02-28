pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/crowdsale/RefundableCrowdsale.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./TokenCappedCrowdsale.sol";
import "./FlyCareToken.sol";


contract FlyCareTokenSale is TokenCappedCrowdsale, RefundableCrowdsale, Pausable {
    using SafeMath for uint256;

    // Constants
    uint256 constant private BIG_BUYER_THRESHOLD = 40 * 10**18; // 40 ETH
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
      TokenCappedCrowdsale(_cap)
      FinalizableCrowdsale()
      RefundableCrowdsale(_goal)
      Crowdsale(_startTime, _endTime, _rate, _wallet)
    {
        require(_goal.mul(_rate) <= _cap);

        for (uint8 i = 0; i < _salePeriods.length; i++) {
            require(_salePeriods[i] > 0);
        }
        salePeriods = _salePeriods;
    }

    function createTokenContract() internal returns (MintableToken) {
        return new FlyCareToken();
    }

    function () whenNotPaused external payable {
        super.buyTokens(msg.sender);
    }

    // low level token purchase function
    function buyTokens(address beneficiary) whenNotPaused public payable {
        super.buyTokens(beneficiary);
    }

    // gamification
    function getRate(uint256 time) internal view returns (uint256) {
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

    function setTeamVault(address _wallet, address _vault, uint64 _shareDiv) onlyOwner public returns (bool) {
        require(now < startTime); // Only before sale starts !
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
            bool capReached = tokenSold >= cap;
            if (!capReached) {
                uint256 tokenUnsold = cap.sub(tokenSold);
                // Mint unsold tokens to sale's address & burn them immediately
                require(token.mint(this, tokenUnsold));
                FlyCareToken(token).burn(tokenUnsold);
            }
          
            uint256 tokenReserved = RESERVE_AMOUNT;
          
            for (uint8 i = 0; i < numTeamMembers; i++) {
                TeamMember memory member = teamMembers[memberLookup[i]];
                if (member.vault != address(0)) {
                    var tokenAmount = tokenSold.div(member.shareDiv);
                    require(token.mint(member.vault, tokenAmount));
                    tokenReserved = tokenReserved.sub(tokenAmount);
                }
            }

            // Allocate remaining reserve to multisig wallet
            require(token.mint(wallet, tokenReserved));

            // Finish token minting & unpause transfers
            require(token.finishMinting());
            FlyCareToken(token).unpause();
        }

        super.finalization();
    }

    function bytesToBytes32(bytes memory source) internal pure returns (bytes32 result) {
        if (source.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }
}
