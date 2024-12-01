const BettingSystem = artifacts.require("BettingSystem");

module.exports = function (deployer) {
  deployer.deploy(BettingSystem);
};
