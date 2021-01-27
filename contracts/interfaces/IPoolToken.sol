// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.7.0;
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

interface IPoolToken is IERC20 {
    function setRatio(uint256 numerator, uint256 denominator) external returns (bool);
    function mint(address account, uint256 amount) external returns (bool);
}