const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const DepositContract = artifacts.require("DepositContract");
const Governor = artifacts.require("Governor");
const C = require("./_const.js");
const utils = require("./_test_utils.js");
 
// Start test block
contract('Governor (proxy)', async accounts => {

    let poolToken;
    let depositContract;
    let pool;
    let governor;

    beforeEach(async () => {
        poolToken = await deployProxy(PoolToken, []);
        depositContract = await DepositContract.new();
        pool = await deployProxy(Pool, [poolToken.address, depositContract.address, C.FEE_DEFAULT]);
        governor = await deployProxy(Governor, [pool.address]);

        // Set PoolToken owner to the Pool
        await poolToken.transferOwnership(pool.address);

        // Set pool governor
        await pool.setGovernor(governor.address);
    });

    it('success: initialization', async () => {
        assert.equal(await governor.oracleCount.call(), 1);
        assert.equal(await governor.oracle.call(0), accounts[0]);
        await utils.tryCatch(governor.oracle.call(1), "Invalid index");
    });
});