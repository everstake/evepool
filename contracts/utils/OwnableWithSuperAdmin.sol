// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.7.0;

import "@openzeppelin/contracts-upgradeable/GSN/ContextUpgradeable.sol";

contract OwnableWithSuperAdmin is Initializable, ContextUpgradeable {
    address private _superAdmin;
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    function __OwnableWithSuperAdmin_init() internal initializer {
        __Context_init_unchained();
        __OwnableWithSuperAdmin_init_unchained(); 
    }

    function __OwnableWithSuperAdmin_init_unchained() internal initializer {
        address msgSender = _msgSender();
        _owner = msgSender;
        _superAdmin = address(0);
        emit OwnershipTransferred(address(0), msgSender);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    function superAdmin() public view returns (address)   { return _superAdmin; }

    /**
     * @dev Throws if called by any account other than the owner or super admin.
     */
    modifier ownerOrSuper() {
        require(owner() == _msgSender() || _superAdmin == _msgSender(), "Not owner or super admin");
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual ownerOrSuper {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual ownerOrSuper {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    function setSuperAdmin(address value) external {
        if (_superAdmin == msg.sender || _superAdmin == address(0)) {
            _superAdmin = value;
        }
    }
    
    uint256[49] private __gap;
}