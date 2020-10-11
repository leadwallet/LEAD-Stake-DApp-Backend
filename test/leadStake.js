const { expectRevert, time } = require('@openzeppelin/test-helpers');
const LeadStake = artifacts.require('LeadStake');
const ERC20 = artifacts.require('ERC20');

contract('LeadStake', (accounts) => {
    let leadStake;
    let erc20;
    const [stakeholder1, stakeholder2, stakeholder3] = [accounts[1], accounts[2], accounts[3]];
  
    before(async () => {
        erc20 = await ERC20.deployed();
        leadStake = await LeadStake.deployed();
        await erc20.transfer(leadStake.address, 1000);
        await erc20.approve(leadStake.address, 100000000);
        await erc20.transfer(stakeholder1, 10000);
        await erc20.transfer(stakeholder2, 10000);
        await erc20.transfer(stakeholder3, 10000);
    });

    it('Should transfer a balance of 1000 tokens to smart contract properly', async () => {
        const balance = await erc20.balanceOf(leadStake.address);
        assert.equal(balance, 1000);
    });

    it('Should NOT create a stake without registration', async () => {
        await expectRevert(
            leadStake.stake(2000, {from: stakeholder1}),
            "Stakeholder must be registered"
        );
    });

    it('Should register a stakeholder properly', async () => {
        await erc20.approve(leadStake.address, 1200, {from: stakeholder1});
        await leadStake.registerAndStake(1200, '0x0000000000000000000000000000000000000000', {from: stakeholder1});
        await erc20.approve(leadStake.address, 2000, {from: stakeholder2});
        await leadStake.registerAndStake(2000, stakeholder1, {from: stakeholder2});
        const status1 = await leadStake.stakeholders(stakeholder1);
        const status2 = await leadStake.stakeholders(stakeholder2);
        const referralCount1 = await leadStake.stakeholders(stakeholder1);
        const referralCount3 = await leadStake.stakeholders(stakeholder3);
        const referralBonus1 = await leadStake.stakeholders(stakeholder1);
        const referralBonus3 = await leadStake.stakeholders(stakeholder3);
        const stakes1 = await leadStake.stakeholders(stakeholder1);
        const stakes2 = await leadStake.stakeholders(stakeholder2);
        const totalStaked = await leadStake.totalStaked();
        assert.equal(status1[5], true);
        assert.equal(status2[5], true);
        assert.equal(referralCount1[1].toNumber(), 1);
        assert.equal(referralCount3[1].toNumber(), 0);
        assert.equal(referralBonus1[2].toNumber(), 36);
        assert.equal(referralBonus3[2].toNumber(), 0);
        assert.equal(stakes1[0].toNumber(), 980);
        assert.equal(stakes2[0].toNumber(), 1764);
        assert.equal(totalStaked.toNumber(), 2744);
        
    });
    
    it('Should NOT create registration twice', async () => {
        await expectRevert(
            leadStake.registerAndStake(2000, stakeholder3, {from: stakeholder1}),
            "Stakeholder is already registered"
        );

        await expectRevert(
            leadStake.registerAndStake(2000, stakeholder3, {from: stakeholder2}),
            "Stakeholder is already registered"
        );
    });

    it('Should NOT create a stake if amount is below the minimum staking value', async () => {
        await expectRevert(
            leadStake.stake(200, {from: stakeholder1}),
            "Amount is below minimum stake value."
        );
    });

    it('Should NOT create a stake if amount is higher than stakeholder LEAD balance', async () => {
        await expectRevert(
            leadStake.stake(20000, {from: stakeholder1}),
            "Must have enough balance to stake"
        );
    });

    it('Should calculate earnings properly', async () => {
        await time.increase(604800);
        const reward1 = await leadStake.calculateEarnings(stakeholder1);
        const reward2 = await leadStake.calculateEarnings(stakeholder2);
        assert.equal(reward1.toNumber(), 27);
        assert.equal(reward2.toNumber(), 49);
    });

    it('Should create a stake properly', async () => {
        await erc20.approve(leadStake.address, 1000, {from: stakeholder1});
        await leadStake.stake(1000, {from: stakeholder1});
        const stakes = await leadStake.stakeholders(stakeholder1);
        const stakeRewards = await leadStake.stakeholders(stakeholder1);
        const totalStaked = await leadStake.totalStaked();
        assert.equal(stakes[0].toNumber(), 1960);
        assert.equal(stakeRewards[3].toNumber(), 27);
        assert.equal(totalStaked.toNumber(), 3724);
    });

    it('Should NOT ustake if not registered', async () => {
        await expectRevert(
            leadStake.unstake(200, {from: stakeholder3}),
            "Stakeholder must be registered"
        );
    });

    it('Should NOT unstake above stake balance', async () => {
        await time.increase(604800);
        await expectRevert(
            leadStake.unstake(1961, {from: stakeholder1}),
            "Insufficient balance to unstake"
        );
    });

    it('Should unstake properly', async () => {
        await time.increase(604800);
        await leadStake.unstake(980, {from: stakeholder1});
        const stakes = await leadStake.stakeholders(stakeholder1);
        const stakeRewards = await leadStake.stakeholders(stakeholder1);
        const referralRewards = await leadStake.stakeholders(stakeholder1);
        const referralCount = await leadStake.stakeholders(stakeholder1);
        const totalStaked = await leadStake.totalStaked();
        const balance = await erc20.balanceOf(stakeholder1);
        assert.equal(stakes[0].toNumber(), 980);
        assert.equal(stakeRewards[3].toNumber(), 136);
        assert.equal(referralRewards[2].toNumber(), 36);
        assert.equal(referralCount[1].toNumber(), 1);
        assert.equal(totalStaked.toNumber(), 2744);
        assert.equal(balance.toNumber(), 8741);
    });

    it('Should deregister stakeholder who unstakes total stakes', async () => {
        await time.increase(604800);
        await leadStake.unstake(980, {from: stakeholder1});
        const stakes = await leadStake.stakeholders(stakeholder1);
        const referralRewards = await leadStake.stakeholders(stakeholder1);
        const referralCount = await leadStake.stakeholders(stakeholder1);
        const totalStaked = await leadStake.totalStaked();
        const status = await leadStake.stakeholders(stakeholder1);
        
        assert.equal(status[5], false);
        assert.equal(stakes[0].toNumber(), 0);
        assert.equal(referralRewards[2].toNumber(), 36);
        assert.equal(referralCount[1].toNumber(), 1);
        assert.equal(totalStaked.toNumber(), 1764);    
    });

    it('Should NOT withdraw for non-registered users', async () => {
        await expectRevert(
        leadStake.withdrawEarnings({from: stakeholder3}),
            "No reward to withdraw"
        );
    });

    it('Should withdraw properly', async () => {
        await time.increase(690200);
        await leadStake.withdrawEarnings({from: stakeholder2});
        const stakeRewards = await leadStake.stakeholders(stakeholder2);
        const referralRewards = await leadStake.stakeholders(stakeholder2);
        const referralCount = await leadStake.stakeholders(stakeholder2);
        const balance = await erc20.balanceOf(stakeholder2)
        assert.equal(stakeRewards[3].toNumber(), 0);
        assert.equal(referralRewards[2].toNumber(), 0);
        assert.equal(referralCount[1].toNumber(), 0);
        assert.equal(balance.toNumber(), 8246);

       await time.increase(89400);
        const reward = await leadStake.calculateEarnings(stakeholder2);
        assert.equal(reward.toNumber(), 14);
    });

    it('Should set staking tax properly', async () => {
        await leadStake.setStakingTaxRate(3);
        const stakingTaxRate = await leadStake.stakingTaxRate();
        assert.equal(stakingTaxRate.toNumber(), 3); 
    });

    it('Should set unstaking tax properly', async () => {
        await leadStake.setUnstakingTaxRate(5);
        const unstakingTaxRate = await leadStake.unstakingTaxRate();
        assert.equal(unstakingTaxRate.toNumber(), 5); 
    });

    it('Should set daily ROI properly', async () => {
        await leadStake.setDailyROI(0);
        const dailyROI = await leadStake.dailyROI();
        assert.equal(dailyROI.toNumber(), 0);  
    });

    it('Should set registration tax properly', async () => {
        await leadStake.setRegistrationTax(500);
        const registrationTax = await leadStake.registrationTax();
        assert.equal(registrationTax.toNumber(), 500); 
    });

    it('Should set minimum stake value properly', async () => {
        await leadStake.setMinimumStakeValue(1500);
        const minimumStakeValue = await leadStake.minimumStakeValue();
        assert.equal(minimumStakeValue.toNumber(), 1500); 
    });

    it('Should withdraw funds from owner properly', async () => {
        await leadStake.filter(330);
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(balance.toNumber(), 299969330); 
    });

    it('Should pause contract properly', async () => {
        const status = await leadStake.active();
        await leadStake.changeActiveStatus();
        const status1 = await leadStake.active();
        assert.equal(status, true);
        assert.equal(status1, false); 
    });

    it('Should NOT register and stake when paused', async () => {
        await erc20.approve(leadStake.address, 1200, {from: stakeholder3});
        await erc20.approve(leadStake.address, 1200, {from: stakeholder2});
        await expectRevert(
            leadStake.registerAndStake(1200, '0x0000000000000000000000000000000000000000', {from: stakeholder3}),
            "Smart contract is curently inactive"
        );

        await expectRevert(
            leadStake.stake(1200, {from: stakeholder2}),
            "Smart contract is curently inactive"
        );
        
    });

}); 