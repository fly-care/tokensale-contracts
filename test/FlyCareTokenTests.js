const assertJump = require('zeppelin-solidity/test/helpers/assertJump');

var StampifyToken = artifacts.require("./FlyCareToken.sol");

// Few basic tests: FlyCareToken is an Open Zeppelin MintableToken,
// whose code is covered by an exhaustive suite of tests.

contract('FlyCareToken', function(accounts) {

    it('should be named \'flyCARE Token\'', async function() {
      let token = await StampifyToken.new();
      let name = await token.name();

      assert.equal(name, "flyCARE Token");
    });

    it('should have \'FCC\' as symbol', async function() {
      let token = await StampifyToken.new();
      let symbol = await token.symbol();

      assert.equal(symbol, "FCC");
    });

    it('should have a precision of 18 decimals', async function() {
      let token = await StampifyToken.new();
      let decimals = await token.decimals();

      assert.equal(decimals, 18);
    });

});
