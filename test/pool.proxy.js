const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const DepositContract = artifacts.require("DepositContract");
const C = require("./_const.js");
 
// Start test block
contract('Pool (proxy)', async accounts => {

    let poolToken;
    let depositContract;
    let pool;

    beforeEach(async () => {
        poolToken = await deployProxy(PoolToken, []);
        depositContract = await DepositContract.new();
        pool = await deployProxy(Pool, [poolToken.address, depositContract.address, C.FEE_DEFAULT]);

        // Set PoolToken owner to the Pool
        await poolToken.transferOwnership(pool.address);

        // Set governor to a non-default account
        await pool.setGovernor(accounts[9]);
    });

    it('success: initialization', async () => {
        let count = await pool.getValidatorCount.call();
        assert.equal(count, 0);

        let governor = await pool.governor.call();
        assert.equal(governor, accounts[9]);

        let tokenOwner = await poolToken.owner.call();
        assert.equal(tokenOwner, pool.address);
    });
});