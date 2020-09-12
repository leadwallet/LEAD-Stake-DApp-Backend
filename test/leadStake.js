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
        await erc20.transfer(leadStake.address, 10);
        await erc20.approve(leadStake.address, 100000000);
        await erc20.transfer(stakeholder1, 10000);
        await erc20.transfer(stakeholder2, 10000);
        await erc20.transfer(stakeholder3, 10000);
    });

    it('Should transfer a balance of 10 tokens to smart contract properly', async () => {
        const balance = await erc20.balanceOf(leadStake.address);
        assert.equal(balance, 10);
    });

    it('Should NOT create a stake without registration', async () => {
        await expectRevert(
            leadStake.stake(2000, {from: stakeholder1}),
            "Staker must be registered"
        );
    });

    it('Should register a stakeholder properly', async () => {
        await erc20.approve(leadStake.address, 1200, {from: stakeholder1});
        await leadStake.registerAndStake(1200, stakeholder2, {from: stakeholder1});
        await erc20.approve(leadStake.address, 2000, {from: stakeholder2});
        await leadStake.registerAndStake(2000, stakeholder3, {from: stakeholder2});
        const status1 = await leadStake.registered(stakeholder1);
        const status2 = await leadStake.registered(stakeholder2);
        const referralCount2 = await leadStake.referralCount(stakeholder2);
        const referralCount3 = await leadStake.referralCount(stakeholder3);
        const referralBonus2 = await leadStake.referralRewards(stakeholder2);
        const referralBonus3 = await leadStake.referralRewards(stakeholder3);
        const stakes1 = await leadStake.stakes(stakeholder1);
        const stakes2 = await leadStake.stakes(stakeholder2);
        const totalStaked = await leadStake.totalStaked();
        const stakeholders = await leadStake.stakeholders;

        for(i = 0; i < stakeholders.length; i+1) {
            let isStakeholder = false;
            if(stakeholders[i] = stakeholder1 && stakeholder2) {
                isStakeholder = true;
            }
            assert.equal(isStakeholder, true);
        }
        assert.equal(status1, true);
        assert.equal(status2, true);
        assert.equal(referralCount2.toNumber(), 1);
        assert.equal(referralCount3.toNumber(), 1);
        assert.equal(referralBonus2.toNumber(), 100);
        assert.equal(referralBonus3.toNumber(), 100);
        assert.equal(stakes1.toNumber(), 980);
        assert.equal(stakes2.toNumber(), 1764);
        assert.equal(totalStaked.toNumber(), 2744);
        
    });
    
    it('Should NOT create registration twice', async () => {
        await expectRevert(
            leadStake.registerAndStake(2000, stakeholder3, {from: stakeholder1}),
            "Staker is already registered"
        );

        await expectRevert(
            leadStake.registerAndStake(2000, stakeholder3, {from: stakeholder2}),
            "Staker is already registered"
        );
    });

    it('Should NOT create a stake if amount is below the minimum staking value', async () => {
        await expectRevert(
            leadStake.stake(200, {from: stakeholder1}),
            "Amount is below minimum stake value."
        );
    });

    it('Should NOT create a stake if amount is hgher than stakeholder LEAD balance', async () => {
        await expectRevert(
            leadStake.stake(20000, {from: stakeholder1}),
            "Must have enough balance to stake"
        );
    });

    it('Should create a stake properly', async () => {
        await erc20.approve(leadStake.address, 1000, {from: stakeholder1});
        await leadStake.stake(1000, {from: stakeholder1});
        const stakes = await leadStake.stakes(stakeholder1);
        const totalStaked = await leadStake.totalStaked();
        assert.equal(stakes.toNumber(), 1960);
        assert.equal(totalStaked.toNumber(), 3724);
    });

    it('Should NOT distribute rewards if non-owner', async () => {
        await expectRevert(
            leadStake.distribute({from: stakeholder2}),
            "Ownable: caller is not the owner"
        );
    });

    it('Should distribute rewards properly', async () => {
        await leadStake.distribute();
        const stakeRewardsForStakeholder1 = await leadStake.stakeRewards(stakeholder1);
        const stakeRewardsForStakeholder2 = await leadStake.stakeRewards(stakeholder2);
        const stakeRewardsForStakeholder3 = await leadStake.stakeRewards(stakeholder3);
        assert.equal(stakeRewardsForStakeholder1.toNumber(), 588);
        assert.equal(stakeRewardsForStakeholder2.toNumber(), 559);
        assert.equal(stakeRewardsForStakeholder3.toNumber(), 0);    //Should have been 30 instead of 0. But since stakehoder3 isn't registerred, funds wouldn't be disbursed
    });

    it('Should NOT withdraw for non-registered users', async () => {
        await expectRevert(
        leadStake.withdrawEarnings({from: stakeholder3}),
            "Staker must be registered"
        );
    });

    it('Should withdraw properly for registered users', async () => {
        await leadStake.withdrawEarnings({from: stakeholder2});
        const stakeRewards = await leadStake.stakeRewards(stakeholder2);
        const referralRewards = await leadStake.referralRewards(stakeholder2);
        const referralCount = await leadStake.referralCount(stakeholder2);
        assert.equal(stakeRewards.toNumber(), 0);
        assert.equal(referralRewards.toNumber(), 0);
        assert.equal(referralCount.toNumber(), 0);
    });

    it('Should NOT withdraw if zero rewards', async () => {
        await expectRevert(
        leadStake.withdrawEarnings({from: stakeholder2}),
            "No reward to withdraw"
        );
    });

    it('Should NOT ustake without registration', async () => {
        await expectRevert(
        leadStake.stake(2000, {from: stakeholder3}),
            "Staker must be registered"
        );
    });

    it('Should NOT unstake above stake balance', async () => {
        await expectRevert(
        leadStake.unstake(1961, {from: stakeholder1}),
            "Insufficient balance to unstake"
        );
    });

    it('Should unstake properly', async () => {
        await leadStake.unstake(980, {from: stakeholder1});
        const stakes = await leadStake.stakes(stakeholder1);
        const referralRewards = await leadStake.referralRewards(stakeholder1);
        const referralCount = await leadStake.referralCount(stakeholder1);
        const totalStaked = await leadStake.totalStaked();
        assert.equal(stakes.toNumber(), 980);
        assert.equal(referralRewards.toNumber(), 0);
        assert.equal(referralCount.toNumber(), 0);
        assert.equal(totalStaked.toNumber(), 2744);
        
    });

    it('Should deregister user who unstakes total stakes', async () => {
        await leadStake.unstake(980, {from: stakeholder1});
        const stakes = await leadStake.stakes(stakeholder1);
        const referralRewards = await leadStake.referralRewards(stakeholder1);
        const referralCount = await leadStake.referralCount(stakeholder1);
        const totalStaked = await leadStake.totalStaked();
        const stakeholders = await leadStake.stakeholders;
        const status = await leadStake.registered(stakeholder1);
        for(i = 0; i < stakeholders.length; i+1) {
            let isStakeholder = true;
            if(stakeholders[i] !== stakeholder1) {
                isStakeholder = false;
            }
            assert.equal(isStakeholder, false);
        }
        assert.equal(status, false);
        assert.equal(stakes.toNumber(), 0);
        assert.equal(referralRewards.toNumber(), 0);
        assert.equal(referralCount.toNumber(), 0);
        assert.equal(totalStaked.toNumber(), 1764);    
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

    it('Should set monthly ROI properly', async () => {
        await leadStake.setMonthlyROI(15);
        const monthlyROI = await leadStake.monthlyROI();
        assert.equal(monthlyROI.toNumber(), 15); 
    });

    it('Should set registration tax properly', async () => {
        await leadStake.setRegistrationTax(500);
        const registrationTax = await leadStake.registrationTax();
        assert.equal(registrationTax.toNumber(), 500); 
    });

    it('Should set referral tax allocation properly', async () => {
        await leadStake.setReferralTaxAllocation(55);
        const referralTaxAllocation = await leadStake.referralTaxAllocation();
        assert.equal(referralTaxAllocation.toNumber(), 55); 
    });

    it('Should set minimum stake value properly', async () => {
        await leadStake.setMinimumStakeValue(1500);
        const minimumStakeValue = await leadStake.minimumStakeValue();
        assert.equal(minimumStakeValue.toNumber(), 1500); 
    });
}); 