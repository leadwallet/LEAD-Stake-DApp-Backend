//"SPDX-License-Identifier: UNLICENSED"

pragma solidity ^0.6.0;

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/math/SafeMath.sol';

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol';

import 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol';

abstract contract LeadStake is IERC20, Ownable {
    
    using SafeMath for uint;
    
    uint stakingTaxRate;
    
    uint unstakingTaxRate;
    
    uint registrationTax;
    
    uint refAllocation;
    
    uint minimumStakeValue;
    
    uint taxVault;
    
    address lead;
    
    address[] internal stakeholders;
    
    mapping(address => uint) public stakes;
    
    mapping(address => uint) public rewards;
    
    mapping(address => uint) public referralCount;
    
    mapping(address => uint) public referralRewards;
    
    mapping(address => bool) internal registeredStakers;
    
    event OnStake(address sender, uint amount, uint tax);
    
    event OnRegisterAndStake(address stakeholder, uint amount, uint totalTax , address _referrer);
    
    constructor(
        address _token,
        uint8 _stakingTaxRate, 
        uint8 _unstakingTaxRate, 
        uint _registrationTax,
        uint _refAllocation,
        uint _minimumStakeValue) public {
            
        lead = _token;
        
        stakingTaxRate = _stakingTaxRate;
        
        unstakingTaxRate = _unstakingTaxRate;
        
        registrationTax = _registrationTax;
        
        refAllocation = _refAllocation;
        
        minimumStakeValue = _minimumStakeValue;
    }
    
    modifier onlyRegistered () {
        
        require(registeredStakers[msg.sender] = true, "Staker must be registered");
        
        _;
    }
    
    
    modifier onlyUnregistered () {
        
        require(registeredStakers[msg.sender] = false, "Staker is already registered");
        _;
    }
   
   
    function registerAndStake(uint _amount, address _referrer) external onlyUnregistered {
        
        require(IERC20(lead).balanceOf(msg.sender) >= _amount, "Must have enough balance to stake");
        
        require(IERC20(lead).transferFrom(msg.sender, address(this), _amount), "Stake failed due to failed amount transfer.");
        
        require(_amount >= registrationTax.add(minimumStakeValue), "Must send at least enough LEAD to pay registration fee.");
        
        uint referralBonus = registrationTax.mul(refAllocation.div(100));
        
        uint finalAmount = _amount.sub(registrationTax);
        
        uint stakingTax = (stakingTaxRate.div(100)).mul(finalAmount);
        
        if(_referrer != address(0x0)) {
            
            referralCount[_referrer]++;
            
            referralRewards[_referrer].add(referralBonus);
            
            taxVault = taxVault.add((registrationTax.sub(referralBonus)).add(stakingTax));
        } else {
            
            taxVault = taxVault.add(registrationTax.add(stakingTax));
        }
        
        stakes[msg.sender] = stakes[msg.sender].add(finalAmount.sub(stakingTax));
        
        registeredStakers[msg.sender] = true;
        
        stakeholders.push(msg.sender);
        
        emit OnRegisterAndStake(msg.sender, _amount, registrationTax.add(stakingTax), _referrer);
    }
    
    
    function stake(uint _amount) external onlyRegistered {
        
        require(_amount >= minimumStakeValue, "Amount is below minimum stake value.");
        
        require(IERC20(lead).balanceOf(msg.sender) >= _amount, "Must have enough balance to stake");
        
        require(IERC20(lead).transferFrom(msg.sender, address(this), _amount), "Stake failed due to failed amount transfer.");
        
        uint stakingTax = (stakingTaxRate.div(100)).mul(_amount);
        
        taxVault = taxVault.add(stakingTax);
        
        stakes[msg.sender] = stakes[msg.sender].add(_amount.sub(stakingTax));
        
        emit OnStake(msg.sender, _amount, stakingTax);
    }


    function unstake(uint _amount) external onlyRegistered {
        
        require(_amount >= stakes[msg.sender], 'Insufficient balance to withdraw');
        
        uint unstakingTax = (unstakingTaxRate.div(100)).mul(_amount);
        
        IERC20(lead).transfer(msg.sender, _amount.sub(unstakingTax));
        
        taxVault = taxVault.add(unstakingTax);
        
        stakes[msg.sender] = stakes[msg.sender].sub(_amount);
        
        if(stakes[msg.sender] == 0) {
            
            _removeStakeholder(msg.sender);
        }
        
        emit OnUnstake(msg.sender, _amount, stakingTax);
    }
    
    
    function _removeStakeholder(address _stakeholder) internal {
        
        registeredStakers[msg.sender] = false;
        
        (bool isStakeholder, uint i) = _isStakeholder(_stakeholder);
        
        if(isStakeholder){
            
            stakeholders[i] = stakeholders[stakeholders.length - 1];
            
            stakeholders.pop();
        }
    }
    
    
    function _isStakeholder(address _address) internal view returns(bool, uint) {
        
        for (uint i = 0; i < stakeholders.length; i += 1){
            
            if (_address == stakeholders[i]) {
                
                return (true, i);
            }
        }
        
        return (false, 0);
    }
    
}