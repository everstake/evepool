const PoolToken = artifacts.require("PoolToken");
const tryCatch = require("./_test_utils.js").tryCatch;

contract("PoolToken", async accounts => {

    let poolToken;

    beforeEach(async () => {
        poolToken = await PoolToken.new();
        await poolToken.initialize();
        // Set owner to a different account
        await poolToken.transferOwnership(accounts[9]);
    });

    it("success: initialization", async () => {
        let name = await poolToken.name.call();
        assert.equal(name, "Everstake Pool ETH");
        let symbol = await poolToken.symbol.call();
        assert.equal(symbol, "EPETH");
        let decimals = await poolToken.decimals.call();
        assert.equal(decimals, 18);
        let owner = await poolToken.owner.call();
        assert.equal(owner, accounts[9]);
    });

    it("fail: if `setRatio` is called by a non-owner", async () => {
        await tryCatch(poolToken.setRatio(1, 2), "Ownable: caller is not the owner");
    });

    it("fail: if `mint` is called by a non-owner", async () => {
        await tryCatch(poolToken.mint(accounts[1], 100), "Ownable: caller is not the owner");
    });

    it("success: `mint` + `setRatio`", async () => {
        const BALANCE_BEFORE = '100';
        const RATIO_NUM = 18;
        const RATIO_DENOM = 12;
        const BALANCE_AFTER = '150';
        
        await poolToken.mint(accounts[1], BALANCE_BEFORE, {from: accounts[9]});
        let balanceBefore = await poolToken.balanceOf.call(accounts[1]);
        assert.equal(balanceBefore, BALANCE_BEFORE);
        await poolToken.setRatio(RATIO_NUM, RATIO_DENOM, {from: accounts[9]});
        let balanceAfter = await poolToken.balanceOf.call(accounts[1]);
        assert.equal(balanceAfter, BALANCE_AFTER);
    });

    it("success: `transfer` + `setRatio`", async () => {
        const BALANCE_BEFORE = '100';
        const AMOUNT_TRANSFER_BEFORE = '20';
        const RATIO_NUM = 18;
        const RATIO_DENOM = 12;
        const AMOUNT_TRANSFER_AFTER = '20';
        const BALANCE_AFTER = '100';
        const BALANCE_TRANSFERRED = '49';  // -1 for the calculation error
        
        await poolToken.mint(accounts[0], BALANCE_BEFORE, {from: accounts[9]});
        let balanceBefore = await poolToken.balanceOf.call(accounts[0]);
        assert.equal(balanceBefore, BALANCE_BEFORE);
        await poolToken.transfer(accounts[1], AMOUNT_TRANSFER_BEFORE);
        await poolToken.setRatio(RATIO_NUM, RATIO_DENOM, {from: accounts[9]});
        await poolToken.transfer(accounts[1], AMOUNT_TRANSFER_AFTER);
        let balanceAfter = await poolToken.balanceOf.call(accounts[0]);
        assert.equal(balanceAfter, BALANCE_AFTER);
        let balanceTransferred = await poolToken.balanceOf.call(accounts[1]);
        assert.equal(balanceTransferred, BALANCE_TRANSFERRED);
    });

    it("success: `transferFrom` + `approve` + `setRatio`", async () => {
        const BALANCE_BEFORE = '100';
        const RATIO_1_NUM = 18;
        const RATIO_1_DENOM = 12;
        const AMOUNT_APPROVE = '30';
        const RATIO_2_NUM = 22;
        const RATIO_2_DENOM = 11;
        const AMOUNT_TRANSFER = '40';
        const BALANCE_AFTER = '160';
        const RATIO_DEFAULT = 555555;
        const BALANCE_TRANSFERRED = '20';
        
        await poolToken.mint(accounts[1], BALANCE_BEFORE, {from: accounts[9]});
        await poolToken.setRatio(RATIO_1_NUM, RATIO_1_DENOM, {from: accounts[9]});
        await poolToken.approve(accounts[0], AMOUNT_APPROVE, {from: accounts[1]});
        await poolToken.setRatio(RATIO_2_NUM, RATIO_2_DENOM, {from: accounts[9]});

        let allowance = await poolToken.allowance.call(accounts[1], accounts[0]);
        assert.equal(allowance, AMOUNT_TRANSFER);
        await poolToken.transferFrom(accounts[1], accounts[2], AMOUNT_TRANSFER);
        
        let balanceAfter = await poolToken.balanceOf.call(accounts[1]);
        assert.equal(balanceAfter, BALANCE_AFTER);
        await poolToken.setRatio(RATIO_DEFAULT, RATIO_DEFAULT, {from: accounts[9]});
        let balanceTransferred = await poolToken.balanceOf.call(accounts[2]);
        assert.equal(balanceTransferred, BALANCE_TRANSFERRED);
    });

    it("success: `transferOwnership`", async () => {
        const BALANCE       = "100000000000000000000000";
        const BALANCE_10X   = "1000000000000000000000000";
        const RATIO_10X_NUM = 500;
        const RATIO_10X_DENOM = 50;
        await poolToken.mint(accounts[1], BALANCE, {from: accounts[9]});
        assert.equal(await poolToken.balanceOf.call(accounts[1]), BALANCE.toString());
        await poolToken.transferOwnership(accounts[2], {from: accounts[9]});
        await poolToken.setRatio(RATIO_10X_NUM, RATIO_10X_DENOM, {from: accounts[2]});
        assert.equal(await poolToken.balanceOf.call(accounts[1]), BALANCE_10X.toString());

        assert.equal(await poolToken.owner.call(), accounts[2]);
    });
});