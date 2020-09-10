//"SPDX-License-Identifier: UNLICENSED"

pragma solidity ^0.6.0;

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/math/SafeMath.sol';

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol';

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol';

abstract contract LeadStake is IERC20, Ownable {
    //initializing safe computations
    using SafeMath for uint;
    
    //LEAD contract address
    address public lead;
    
    //total amount of staked lead
    uint public totalStaked;
    
    //tax rate for staking in percentage
    uint public stakingTaxRate;
    
    //tax for registration
    uint public registrationTax;
    
    //monthly return of investment in percentage
    uint8 public monthlyROI;
    
    //total amount of LEAD distributed
    uint public totalDistributed;
    
    //tax rate for unstaking in percentage
    uint public unstakingTaxRate;
    
    //minimum stakeable LEAD 
    uint public minimumStakeValue;
    
    //referral allocation from the registration tax
    uint public referralTaxAllocation;
    
    //array of stakeholders' addresses
    address[] internal stakeholders;
    
    //mapping of stakeholders' address to number of stakes
    mapping(address => uint) public stakes;
    
    //mapping of stakeholders' address to stake rewards
    mapping(address => uint) public stakeRewards;
    
    //mapping of stakeholders address to number of referrals 
    mapping(address => uint) public referralCount;
    
    //mapping of stakeholders address to referral rewards earned 
    mapping(address => uint) public referralRewards;
    
    //mapping of addresses to verify registered stakers
    mapping(address => bool) internal registeredStakers;
    
    //Events
    event OnDistribute(address sender, uint time);
    event OnWithdrawal(address sender, uint amount);
    event OnStake(address sender, uint amount, uint tax);
    event OnUnstake(address sender, uint amount, uint tax);
    event OnDeposit(address sender, uint amount, uint time);
    event OnRegisterAndStake(address stakeholder, uint amount, uint totalTax , address _referrer);
    
    /**
     * @dev Sets the initial values for lead, stakingTaxRate, unstakingTaxRate, referralTaxAllocation,
     * and minimumStakeValue.
     */
    constructor(
        address _token,
        uint8 _stakingTaxRate, 
        uint8 _unstakingTaxRate,
        uint8 _monthlyROI,
        uint _registrationTax,
        uint _referralTaxAllocation,
        uint _minimumStakeValue) public {
            
        lead = _token;
        
        stakingTaxRate = _stakingTaxRate;
        
        unstakingTaxRate = _unstakingTaxRate;
        
        monthlyROI = _monthlyROI;
        
        registrationTax = _registrationTax;
        
        referralTaxAllocation = _referralTaxAllocation;
        
        minimumStakeValue = _minimumStakeValue;
    }
    
    //exclusive access for registered address
    modifier onlyRegistered () {
        
        require(registeredStakers[msg.sender] = true, "Staker must be registered");
        
        _;
    }
    
    //exclusive access for unregistered address
    modifier onlyUnregistered () {
        
        require(registeredStakers[msg.sender] = false, "Staker is already registered");
        _;
    }
    
    /**
     * registers and creates stakes for new stakeholders
     * 
     * deducts the registration tax and staking tax
     * 
     * calculates refferal bonus from the registration tax and sends it to the _referrer if there is one
     * 
     * transfers LEAD from sender's address into the smart contract
     *
     * Emits an {OnRegisterAndStake} event..
     */
    function registerAndStake(uint _amount, address _referrer) external onlyUnregistered {
        
        require(IERC20(lead).balanceOf(msg.sender) >= _amount, "Must have enough balance to stake");
        
        require(IERC20(lead).transferFrom(msg.sender, address(this), _amount), "Stake failed due to failed amount transfer.");
        
        require(_amount >= registrationTax.add(minimumStakeValue), "Must send at least enough LEAD to pay registration fee.");
        
        uint referralBonus = registrationTax.mul(referralTaxAllocation.div(100));
        
        uint finalAmount = _amount.sub(registrationTax);
        
        uint stakingTax = (stakingTaxRate.div(100)).mul(finalAmount);
        
        if(_referrer != address(0x0)) {
            
            referralCount[_referrer]++;
            
            referralRewards[_referrer].add(referralBonus);
            
        } 
        
        stakes[msg.sender] = stakes[msg.sender].add(finalAmount.sub(stakingTax));
        
        totalStaked = totalStaked.add(_amount.sub(stakingTax));
        
        registeredStakers[msg.sender] = true;
        
        stakeholders.push(msg.sender);
        
        emit OnRegisterAndStake(msg.sender, _amount, registrationTax.add(stakingTax), _referrer);
    }
    
    /**
     * creates stakes for already registered stakeholders
     * 
     * deducts the staking tax from _amount inputted
     * 
     * registers the remainder in the stakes of the sender
     *
     * Emits an {OnStake} event
     */
    function stake(uint _amount) external onlyRegistered {
        
        require(_amount >= minimumStakeValue, "Amount is below minimum stake value.");
        
        require(IERC20(lead).balanceOf(msg.sender) >= _amount, "Must have enough balance to stake");
        
        require(IERC20(lead).transferFrom(msg.sender, address(this), _amount), "Stake failed due to failed amount transfer.");
        
        uint stakingTax = (stakingTaxRate.div(100)).mul(_amount);
        
        totalStaked = totalStaked.add(_amount.sub(stakingTax));
        
        stakes[msg.sender] = stakes[msg.sender].add(_amount.sub(stakingTax));
        
        emit OnStake(msg.sender, _amount, stakingTax);
    }

    /**
     * removes '_amount' stakes for already registered stakeholders
     * 
     * deducts the unstaking tax from '_amount'
     * 
     * transfers the sum of the remainder, stake rewards and referral rewards to the sender 
     * 
     * deregisters stakeholder if all the stakes are removed
     *
     * Emits an {OnStake} event
     */
    function unstake(uint _amount) external onlyRegistered {
        
        require(_amount >= stakes[msg.sender], 'Insufficient balance to withdraw');
        
        uint unstakingTax = (unstakingTaxRate.div(100)).mul(_amount);
        
        stakeRewards[msg.sender] = stakeRewards[msg.sender].add(referralRewards[msg.sender].add(_amount.sub(unstakingTax)));
        
        IERC20(lead).transfer(msg.sender, stakeRewards[msg.sender]);
        
        stakes[msg.sender] = stakes[msg.sender].sub(_amount);
        
        referralRewards[msg.sender] =0;
        
        totalStaked = totalStaked.sub(_amount);
        
        if(stakes[msg.sender] == 0) {
            
            _removeStakeholder(msg.sender);
        }
        
        emit OnUnstake(msg.sender, _amount, unstakingTax);
    }
    
    /**
     * deregisters _stakeholder and removes address from stakeholders array
     */
    function _removeStakeholder(address _stakeholder) internal {
        
        registeredStakers[msg.sender] = false;
        
        (bool isStakeholder, uint i) = _isStakeholder(_stakeholder);
        
        if(isStakeholder){
            
            stakeholders[i] = stakeholders[stakeholders.length - 1];
            
            stakeholders.pop();
        }
    }
    
     /**
     * checks if _address is a registered stakeholder
     * 
     * returns 'true' and 'id number' if stakeholder and 'false' and '0'  if not
     */
    function _isStakeholder(address _address) internal view returns(bool, uint) {
        
        for (uint i = 0; i < stakeholders.length; i += 1){
            
            if (_address == stakeholders[i]) {
                
                return (true, i);
            }
        }
        
        return (false, 0);
    }
    
     /**
     * @dev Should be callsed once on a monthly basis
     * distributes tokens to the stakeholders' rewards ready for withdrawal
     */
    function distribute() external onlyOwner {
        
        uint totalClaimable;
        
        for(uint i = 0; i < stakeholders.length; i++){
            
            uint reward = _calculatePayment(stakeholders[i]);
            
            stakeRewards[stakeholders[i]] = stakeRewards[stakeholders[i]].add(reward);
            
            totalClaimable = totalClaimable.add(stakes[stakeholders[i]].add(stakeRewards[stakeholders[i]].add(referralRewards[stakeholders[i]])));
        }
        
        _deposit(totalClaimable.sub(IERC20(lead).balanceOf(address(this))));
       
        emit OnDistribute(msg.sender, now);
    }

    
    function _calculatePayment(address _stakeholder) internal view returns(uint){
        
        require(IERC20(lead).balanceOf(address(this)) > 0, 'Empty pool');
        
        return stakes[_stakeholder].mul(monthlyROI).div(100);                                                       //monthly earning
    }
    
    
    function _deposit(uint _amount) internal {
        
        require(IERC20(lead).balanceOf(msg.sender) >= _amount, 'Insufficient LEAD balance');                //owner must have enough LEAD in wallet
        
        IERC20(lead).transferFrom(msg.sender, address(this), _amount);
       
        emit OnDeposit(msg.sender, _amount, now);
    }
    
    
    function withdrawEarnings() public onlyRegistered returns(bool success) {
        
        require(stakeRewards[msg.sender] > 0 || referralRewards[msg.sender] > 0, 'No balance to withdraw'); 
        
        uint totalReward = referralRewards[msg.sender].add(stakeRewards[msg.sender]);
        
        IERC20(lead).transfer(msg.sender, totalReward);
        
        stakeRewards[msg.sender] = 0;
        
        referralRewards[msg.sender] = 0;
        
        emit OnWithdrawal(msg.sender, totalReward);
        
        return true;
    }
    
    function setStakingTaxRate(uint8 _stakingTaxRate) external onlyOwner {
        stakingTaxRate = _stakingTaxRate;
    }
    
    function setUnstakingTaxRate(uint8 _unstakingTaxRate) external onlyOwner {
        unstakingTaxRate = _unstakingTaxRate;
    }
    
    function setMonthlyROI(uint8 _monthlyROI) external onlyOwner {
        monthlyROI = _monthlyROI;
    }
    
    function setRegistrationTax(uint _registrationTax) external onlyOwner {
        registrationTax = _registrationTax;
    }
    
    function setReferralTaxAllocation(uint _referralTaxAllocation) external onlyOwner {
        referralTaxAllocation = _referralTaxAllocation;
    }
    
    function setMinimumStakeValue(uint _minimumStakeValue) external onlyOwner {
        minimumStakeValue = _minimumStakeValue;
    }

}