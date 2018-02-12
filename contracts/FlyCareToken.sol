pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";


contract FlyCareToken is MintableToken, PausableToken, BurnableToken {

    string public constant name = "FlyCare Token";
    string public constant symbol = "FCC";
    uint8 public constant decimals = 18;

    function FlyCareToken() public {
        pause();
    }
}
