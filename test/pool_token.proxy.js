const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const PoolToken = artifacts.require("PoolToken");
 
// Start test block
contract('Pool Token (proxy)', async accounts => {

    let poolToken;

    beforeEach(async () => {
        poolToken = await deployProxy(PoolToken, []);

        // Set owner to a different account
        await poolToken.transferOwnership(accounts[9]);
    });

    it('success: initialization', async () => {
        let name = await poolToken.name.call();
        assert.equal(name, "Eveth");
        let symbol = await poolToken.symbol.call();
        assert.equal(symbol, "EVETH");
        let decimals = await poolToken.decimals.call();
        assert.equal(decimals, 18);
        let owner = await poolToken.owner.call();
        assert.equal(owner, accounts[9]);
    });
});