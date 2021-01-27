// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

interface IPool {
    function setRewards(uint256 rewards) external returns (bool);
    function setFee(uint256 fee) external returns (bool);
}