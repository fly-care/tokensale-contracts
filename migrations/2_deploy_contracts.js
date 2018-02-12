const Token = artifacts.require("FlyCareToken");

module.exports = function(deployer) {
  deployer.deploy(Token);
};
