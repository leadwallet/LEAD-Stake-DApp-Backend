const LeadStake = artifacts.require("LeadStake");
const ERC20 = artifacts.require("ERC20");

module.exports = async function(deployer, _network) {
    await deployer.deploy(ERC20, 'LeadToken', 'LEAD', 300000000);
    const token = await ERC20.deployed();
    await deployer.deploy(LeadStake, token.address, 2, 4, 30, 200, 50, 1000);
  
};
