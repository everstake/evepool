// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "openzeppelin-solidity/contracts/utils/EnumerableSet.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/Math.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./interfaces/IDepositContract.sol";
import "./interfaces/IPoolToken.sol";
import "./interfaces/IPool.sol";

contract Pool is Ownable, IPool {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    event StakeAdded(address staker, uint256 value);
    event StakeCanceled(address staker, uint256 value);
    event StakeDeposited(address staker, uint256 value, bytes validator);
    event GovernorChanged(address oldGovernor, address newGovernor);
    event RewardsUpdated(uint256 oldRewards, uint256 newRewards);
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    uint256 constant BEACON_AMOUNT = 32 ether;
    uint256 constant MIN_STAKE = 1 ether / 100;

    IPoolToken private _poolToken;
    IDepositContract private _depositContract;

    uint256 private _poolBalance = 0;
    uint256 private _poolFeeBalance = 0;
    uint256 private _poolRewardsBalance = 0;
    uint256 private _pendingBalance = 0;
    struct Staker {
        address _address;
        uint256 _amount;
    }
    mapping(uint256 => Staker) private _queue;
    uint256 private _queueFirst = 1;
    uint256 private _queueLast = 0;
    mapping(address => uint256) private _queueBalances;

    bytes[] private _validators;
    address private _governor;

    uint256 private _poolFee; // Pool fee in bips (1/10000)
    uint256 constant FEE_DENOMINATOR = 10000;

    constructor(
        IPoolToken poolToken,
        IDepositContract depositContract,
        uint256 poolFee
    ) public {
        _poolToken = poolToken;
        _depositContract = depositContract;
        _governor = msg.sender;
        _poolFee = poolFee;
    }

    modifier onlyGovernor() {
        require(_governor == msg.sender, "Caller is not the governor");
        _;
    }

    function pendingBalanceOf(address account) public view returns (uint256) {
        return _queueBalances[account];
    }

    function pendingBalance() public view returns (uint256) {
        return _pendingBalance;
    }

    function balance() public view returns (uint256) {
        return _poolBalance;
    }

    function feeBalance() public view returns (uint256) {
        return _poolFeeBalance;
    }

    function rewards() public view returns (uint256) {
        return _poolRewardsBalance;
    }

    function fee() public view returns (uint256) {
        return _poolFee;
    }

    function stake() public payable {
        _stake(msg.sender, msg.value);
    }

    function _stake(address staker, uint256 value) private {
        require(value >= MIN_STAKE, "Stake too small");

        _pendingBalance = _pendingBalance.add(value);

        _queueBalances[staker] = _queueBalances[staker].add(value);
        _queueLast += 1;
        _queue[_queueLast] = Staker({_address: staker, _amount: value});

        emit StakeAdded(staker, value);
    }

    function unstake() public {
        uint256 pendingAmount = _queueBalances[msg.sender];
        require(pendingAmount > 0, "Nothing to unstake");

        _pendingBalance = _pendingBalance.sub(pendingAmount);
        _queueBalances[msg.sender] = 0;

        for (uint256 i = _queueFirst; i <= _queueLast; i++) {
            if (_queue[i]._address == msg.sender) {
                _queue[i]._amount = 0;
            }
        }

        bool success = msg.sender.send(pendingAmount);
        require(success, "Transfer failed");
        emit StakeCanceled(msg.sender, pendingAmount);
    }

    function deposit(
        bytes calldata pubkey,
        bytes calldata withdrawal_credentials,
        bytes calldata signature,
        bytes32 deposit_data_root
    ) public onlyOwner {
        require(_pendingBalance >= BEACON_AMOUNT, "Not enough balance");

        _pendingBalance = _pendingBalance.sub(BEACON_AMOUNT);
        _poolBalance = _poolBalance.add(BEACON_AMOUNT);

        // Remove pending balance for individual stakers
        uint256 pendingDepositAmount = BEACON_AMOUNT;

        while (_queueLast >= _queueFirst && pendingDepositAmount > 0) {
            Staker storage staker = _queue[_queueFirst];

            if (staker._amount != 0) {
                uint256 pendingStakerAmount =
                    Math.min(staker._amount, pendingDepositAmount);
                pendingDepositAmount = pendingDepositAmount.sub(
                    pendingStakerAmount
                );

                _queueBalances[staker._address] = _queueBalances[
                    staker._address
                ]
                    .sub(pendingStakerAmount);
                staker._amount = staker._amount.sub(pendingStakerAmount);

                _poolToken.mint(staker._address, pendingStakerAmount);
                emit StakeDeposited(
                    staker._address,
                    pendingStakerAmount,
                    pubkey
                );
            }

            if (staker._amount == 0) {
                delete _queue[_queueFirst];
                _queueFirst += 1;
            }
        }
        require(pendingDepositAmount == 0, "Not enough balance in queue");

        _depositContract.deposit{value: BEACON_AMOUNT}(
            pubkey,
            withdrawal_credentials,
            signature,
            deposit_data_root
        );

        _validators.push(pubkey);
    }

    function getValidatorCount() public view returns (uint256) {
        return _validators.length;
    }

    function getValidator(uint256 index) public view returns (bytes memory) {
        require(index < _validators.length, "Invalid index");
        return _validators[index];
    }

    function governor() public view returns (address) {
        return _governor;
    }

    function setGovernor(address newGovernor) public virtual onlyGovernor {
        emit GovernorChanged(_governor, newGovernor);
        _governor = newGovernor;
    }

    function setRewards(uint256 rewardsValue)
        external
        override
        onlyGovernor
        returns (bool)
    {
        if (rewardsValue <= _poolRewardsBalance) {
            return false;
        }
        uint256 rewardsDiff = rewardsValue.sub(_poolRewardsBalance).sub(_poolFeeBalance);
        uint256 rewardsFee = _calculateFee(rewardsDiff);

        _poolFeeBalance = _poolFeeBalance.add(rewardsFee);

        uint256 newRewardsBalance = _poolRewardsBalance.add(rewardsDiff).sub(rewardsFee);

        emit RewardsUpdated(_poolRewardsBalance, newRewardsBalance);
        _poolRewardsBalance = newRewardsBalance;
        _updateTokenRatio();
        return true;
    }

    function updateTokenRatio() external onlyOwner {
        _updateTokenRatio();
    }

    function _updateTokenRatio() private {
        _poolToken.setRatio(_poolRewardsBalance.add(_poolBalance), _poolToken.totalSupply());
    }

    function setFee(uint256 feeValue) external override onlyGovernor returns (bool) {
        if (feeValue > FEE_DENOMINATOR) {
            return false;
        }
        emit FeeUpdated(_poolFee, feeValue);
        _poolFee = feeValue;
        return true;
    }

    function _calculateFee(uint256 amount) private view returns (uint256) {
        return (amount * _poolFee) / FEE_DENOMINATOR;
    }
}
