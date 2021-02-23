const BN = require('bn.js');
const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const DepositContract = artifacts.require("DepositContract");
const truffleAssert = require('truffle-assertions');
const utils = require("./_test_utils.js");
const C = require("./_const.js");
const DEPOSIT_DATA = require("./_const.js").DEPOSIT_DATA;

contract("Pool", async accounts => {

    let poolToken;
    let depositContract;
    let pool;

    beforeEach(async () => {
        poolToken = await PoolToken.new();
        await poolToken.initialize();
        depositContract = await DepositContract.new();
        pool = await Pool.new();
        await pool.initialize(poolToken.address, depositContract.address, C.FEE_DEFAULT);

        // Set PoolToken owner to the Pool
        await poolToken.transferOwnership(pool.address);

        // Set governor to a non-default account
        await pool.setGovernor(accounts[9]);
    });

    it("success: initialization", async () => {
        let count = await pool.getValidatorCount.call();
        assert.equal(count, 0);
        let governor = await pool.governor.call();
        assert.equal(governor, accounts[9]);
    });

    it("fail: `getValidator` access non existing validator", async () => {
        await utils.tryCatch(pool.getValidator.call(1), "Invalid index");
    });

    it("success: `stake`", async () => {
        // Save ETH balance of the staker to compare later
        let balanceBefore = new BN(await web3.eth.getBalance(accounts[0]));

        // Stake #1
        let tx1 = await pool.stake({value: C.BN_ALMOST_BEACON});

        // Test if StakeAdded event was emitted duting staking
        truffleAssert.eventEmitted(tx1, 'StakeAdded', (ev) => {
            return ev.staker == accounts[0] && ev.value.eq(C.BN_ALMOST_BEACON);
        });

        // Check account pending balance
        let pendingBalance = await pool.pendingBalanceOf.call(accounts[0]);
        assert.equal(pendingBalance.toString(), C.BN_ALMOST_BEACON);

        // Stake #2 from the same account
        let tx2 = await pool.stake({value: C.BN_MIN_STAKE});

        // Check pending balance after the second stake
        pendingBalance = await pool.pendingBalanceOf.call(accounts[0]);
        assert.equal(pendingBalance.toString(), C.BN_ALMOST_BEACON.add(C.BN_MIN_STAKE));

        // Calculate ETH balance difference, should be total staked + fees
        let balanceAfter = new BN(await web3.eth.getBalance(accounts[0]));
        let ethDiff = balanceBefore.sub(balanceAfter);
        let totalStaked = C.BN_ALMOST_BEACON.add(C.BN_MIN_STAKE); 
        let tx1Fee = await utils.getTransactionFee(tx1);
        let tx2Fee = await utils.getTransactionFee(tx2);
        assert.equal(ethDiff.toString(), totalStaked.add(tx1Fee).add(tx2Fee).toString());
    });

    it("fail: `stake` amount too small", async () => {
        // Should revert if stake amount is too small
        await utils.tryCatch(pool.stake({value: C.BN_ALMOST_MIN_STAKE}), "Stake too small");
    });

    it("success: `unstake`", async () => {
        // First stake and check pending balance
        await pool.stake({value: C.BN_MIN_STAKE});
        let pendingBalance = await pool.pendingBalanceOf.call(accounts[0]);
        assert.equal(pendingBalance.toString(), C.BN_MIN_STAKE);

        // Save ETH balance to check if proper amount was returned
        let balanceBefore = new BN(await web3.eth.getBalance(accounts[0]));

        // Unstake pending funds
        let tx = await pool.unstake();

        // Test if StakeCanceled event was emitted duting unstaking
        truffleAssert.eventEmitted(tx, 'StakeCanceled', (ev) => {
            return ev.staker == accounts[0] && ev.value.eq(C.BN_MIN_STAKE);
        });

        // Pending balance should become zero
        pendingBalance = await pool.pendingBalanceOf.call(accounts[0]);
        assert.equal(pendingBalance, 0);

        // And stake amount should return to ETH balance
        let balanceAfter = new BN(await web3.eth.getBalance(accounts[0]));
        let ethDiff = balanceAfter.sub(balanceBefore).add(await utils.getTransactionFee(tx));
        assert.equal(ethDiff.toString(), C.BN_MIN_STAKE);
    });

    it("fail: `unstake`", async () => {
        // Should revert if unstaking without staking first
        await utils.tryCatch(pool.unstake(), "Nothing to unstake");
    });

    it("fail: `deposit` if nothing was staked", async () => {
        // Should revert if nothing is pending
        await utils.tryCatch(pool.deposit(
            DEPOSIT_DATA[0].PUBKEY, 
            DEPOSIT_DATA[0].WITHDRAW, 
            DEPOSIT_DATA[0].SIGNATURE, 
            DEPOSIT_DATA[0].ROOT), "Not enough balance");
    });

    it("fail: `deposit` if not enough was staked", async () => {
        // Should revert if pending balance is slightly less than enough
        await pool.stake({value: C.BN_ALMOST_BEACON});
        await utils.tryCatch(pool.deposit(
            DEPOSIT_DATA[0].PUBKEY, 
            DEPOSIT_DATA[0].WITHDRAW, 
            DEPOSIT_DATA[0].SIGNATURE, 
            DEPOSIT_DATA[0].ROOT), "Not enough balance");
    });

    it("success: `deposit` (single user, stake completely used)", async () => {
        await pool.stake({value: C.BN_BEACON, from: accounts[2]});
        let tx = await pool.deposit(
            DEPOSIT_DATA[0].PUBKEY, 
            DEPOSIT_DATA[0].WITHDRAW, 
            DEPOSIT_DATA[0].SIGNATURE, 
            DEPOSIT_DATA[0].ROOT);

        // Unstakable balance should be zero
        let unstakableBalance = await pool.unstakableBalance.call(accounts[2]);
        assert.equal(unstakableBalance, 0);

        // Check saved validators
        assert.equal(await pool.getValidatorCount.call(), 1);
        assert.equal(await pool.getValidator.call(0), DEPOSIT_DATA[0].PUBKEY);

        // Checking events
        truffleAssert.eventEmitted(tx, 'StakeDeposited', (ev) => {
            return ev.validator == DEPOSIT_DATA[0].PUBKEY;
        });

        // Claimable balance should be the full stake
        claimableBalance = await pool.claimableBalance.call(accounts[2]);
        assert.equal(claimableBalance.toString(), C.BN_BEACON);

        // Claim tokens
        await pool.claim({from: accounts[2]});

        // Claimable balance should become zero
        claimableBalance = await pool.claimableBalance.call(accounts[2]);
        assert.equal(claimableBalance, 0);

        // User should receive amount of tokens equal to deposited ETH
        let tokenBalance = await poolToken.balanceOf.call(accounts[2]);
        assert.equal(tokenBalance.toString(), C.BN_BEACON);
    });

    it("success: `deposit` (single user, stake partialy used)", async () => {
        // Check our constants just to be safe
        assert(C.BN_BEACON_PLUS.gt(C.BN_BEACON), "Test configuration problem");

        // Stake and deposit
        await pool.stake({value: C.BN_BEACON_PLUS});
        let tx = await pool.deposit(
            DEPOSIT_DATA[2].PUBKEY, 
            DEPOSIT_DATA[2].WITHDRAW, 
            DEPOSIT_DATA[2].SIGNATURE, 
            DEPOSIT_DATA[2].ROOT);

        // There should be a small unstakable balance
        unstakableBalance = await pool.unstakableBalance.call(accounts[0]);
        assert.equal(unstakableBalance, C.BN_BEACON_PLUS.sub(C.BN_BEACON).toString());

        // Checking events
        truffleAssert.eventEmitted(tx, 'StakeDeposited', (ev) => {
            return ev.validator == DEPOSIT_DATA[2].PUBKEY;
        });

        // Claim tokens
        await pool.claim({from: accounts[0]});

        // User should receive amount of tokens equal to deposited ETH
        let tokenBalance = await poolToken.balanceOf.call(accounts[0]);
        assert.equal(tokenBalance.toString(), C.BN_BEACON);
    });

    it("success: `deposit` (multiple users)", async () => {
        const USER_STAKE = C.BN_BEACON.muln(4).divn(5);    // 4/5 of a required stake

        // Three users stake
        await pool.stake({value: USER_STAKE, from: accounts[5]});
        await pool.stake({value: USER_STAKE, from: accounts[6]});
        await pool.stake({value: USER_STAKE, from: accounts[7]});

        // Check total pending balance
        let totalPending = await pool.pendingBalance.call();
        assert.equal(totalPending.toString(), USER_STAKE.muln(3));

        // Check unstakable balance
        assert.equal((await pool.unstakableBalance.call(accounts[5])).toString(), 0);
        assert.equal((await pool.unstakableBalance.call(accounts[6])).toString(), 0);
        assert.equal((await pool.unstakableBalance.call(accounts[7])).toString(), C.BN_BEACON.muln(2).divn(5));

        // And deposit
        let tx1 = await pool.deposit(
            DEPOSIT_DATA[4].PUBKEY, 
            DEPOSIT_DATA[4].WITHDRAW, 
            DEPOSIT_DATA[4].SIGNATURE, 
            DEPOSIT_DATA[4].ROOT);

        // Check total pending balance after the deposit
        totalPending = await pool.pendingBalance.call();
        assert.equal(totalPending.toString(), USER_STAKE.muln(3).sub(C.BN_BEACON));

        // Check total pool balance after the deposit
        let poolBalance = await pool.balance.call();
        assert.equal(poolBalance.toString(), C.BN_BEACON);
        
        // Check events
        truffleAssert.eventEmitted(tx1, 'StakeDeposited', (ev) => {
            return ev.validator == DEPOSIT_DATA[4].PUBKEY;
        });

        // Check user token balances
        assert.equal(await poolToken.balanceOf.call(accounts[5]), 0);
        assert.equal(await poolToken.balanceOf.call(accounts[6]), 0);
        assert.equal(await poolToken.balanceOf.call(accounts[7]), 0);

        // Claim tokens
        let txClaim = await pool.claim({from: accounts[5]});
        truffleAssert.eventEmitted(txClaim, 'TokensClaimed', (ev) => {
            return ev.staker == accounts[5] && ev.value == USER_STAKE.toString() && ev.validator == DEPOSIT_DATA[4].PUBKEY;
        });

        // Check user token balances
        assert.equal(await poolToken.balanceOf.call(accounts[5]), USER_STAKE.toString());
        assert.equal(await poolToken.balanceOf.call(accounts[6]), 0);
        assert.equal(await poolToken.balanceOf.call(accounts[7]), 0);

        txClaim = await pool.claim({from: accounts[6]});
        truffleAssert.eventEmitted(txClaim, 'TokensClaimed', (ev) => {
            return ev.staker == accounts[6] && ev.value == USER_STAKE.divn(4).toString() && ev.validator == DEPOSIT_DATA[4].PUBKEY;
        });
        txClaim = await pool.claim({from: accounts[7]});
        truffleAssert.eventNotEmitted(txClaim, 'TokensClaimed');

        // Check user token balances
        assert.equal(await poolToken.balanceOf.call(accounts[5]), USER_STAKE.toString());
        assert.equal(await poolToken.balanceOf.call(accounts[6]), USER_STAKE.divn(4).toString());
        assert.equal(await poolToken.balanceOf.call(accounts[7]), 0);

        // Another deposit
        let tx2 = await pool.deposit(
            DEPOSIT_DATA[3].PUBKEY, 
            DEPOSIT_DATA[3].WITHDRAW, 
            DEPOSIT_DATA[3].SIGNATURE, 
            DEPOSIT_DATA[3].ROOT);

        // Check saved validators
        assert.equal(await pool.getValidatorCount.call(), 2);
        assert.equal(await pool.getValidator.call(0), DEPOSIT_DATA[4].PUBKEY);
        assert.equal(await pool.getValidator.call(1), DEPOSIT_DATA[3].PUBKEY);
        
        // Check total pending balance after the second deposit
        totalPending = await pool.pendingBalance.call();
        assert.equal(totalPending.toString(), USER_STAKE.muln(3).sub(C.BN_BEACON).sub(C.BN_BEACON));

        // Check total pool balance after the second deposit
        poolBalance = await pool.balance.call();
        assert.equal(poolBalance.toString(), C.BN_BEACON.add(C.BN_BEACON));

        // Check events
        truffleAssert.eventEmitted(tx2, 'StakeDeposited', (ev) => {
            return ev.validator == DEPOSIT_DATA[3].PUBKEY;
        });

        // Check user token balances
        assert.equal(await poolToken.balanceOf.call(accounts[5]), USER_STAKE.toString());
        assert.equal(await poolToken.balanceOf.call(accounts[6]), USER_STAKE.divn(4).toString());
        assert.equal(await poolToken.balanceOf.call(accounts[7]), 0);

        // Claim tokens
        txClaim = await pool.claim({from: accounts[5]});
        truffleAssert.eventNotEmitted(txClaim, 'TokensClaimed');
        txClaim = await pool.claim({from: accounts[6]});
        truffleAssert.eventEmitted(txClaim, 'TokensClaimed', (ev) => {
            return ev.staker == accounts[6] && ev.value == USER_STAKE.divn(4).muln(3).toString() && ev.validator == DEPOSIT_DATA[3].PUBKEY;
        });
        txClaim = await pool.claim({from: accounts[7]});
        truffleAssert.eventEmitted(txClaim, 'TokensClaimed', (ev) => {
            return ev.staker == accounts[7] && ev.value == USER_STAKE.divn(4).muln(2).toString() && ev.validator == DEPOSIT_DATA[3].PUBKEY;
        });

        // Check user token balances
        assert.equal(await poolToken.balanceOf.call(accounts[5]), USER_STAKE.toString());
        assert.equal(await poolToken.balanceOf.call(accounts[6]), USER_STAKE.toString());
        assert.equal(await poolToken.balanceOf.call(accounts[7]), USER_STAKE.divn(4).muln(2).toString());

        // Claim again no new tokens
        await pool.claim({from: accounts[6]});
        await pool.claim({from: accounts[7]});
        assert.equal(await poolToken.balanceOf.call(accounts[6]), USER_STAKE.toString());
        assert.equal(await poolToken.balanceOf.call(accounts[7]), USER_STAKE.divn(4).muln(2).toString());
    });

    it("fail: invalid deposit data", async () => {
        // Should revert if incorrect data is sent to the deposit
        await pool.stake({value: C.BN_BEACON, from: accounts[4]});
        await utils.tryCatch(pool.deposit(
            DEPOSIT_DATA[0].PUBKEY, 
            DEPOSIT_DATA[0].WITHDRAW, 
            DEPOSIT_DATA[1].SIGNATURE, 
            DEPOSIT_DATA[0].ROOT), "DepositContract");
    });

    it("fail: `setGovernor` from non-governor", async () => {
        await utils.tryCatch(pool.setGovernor(accounts[5]), "Caller is not the governor");
    });

    it("success: `setGovernor`", async () => {
        let tx = await pool.setGovernor(accounts[5], { from: accounts[9] });
        assert.equal(await pool.governor.call(), accounts[5]);
        truffleAssert.eventEmitted(tx, 'GovernorChanged', (ev) => {
            return ev.oldGovernor == accounts[9] && ev.newGovernor == accounts[5];
        });
    });

    it("fail: `setRewards` from non-governor", async () => {
        await utils.tryCatch(pool.setRewards(555), "Caller is not the governor");
    });

    it("success: `setRewards`", async () => {
        // Setup all constants to test later
        const REWARDS = C.BN_ETH;
        const FEE = C.BN_ETH.divn(100); // 1% default fee
        const POOL_REWARDS_0 = new BN(0);
        const POOL_REWARDS_1 = POOL_REWARDS_0.add(REWARDS).sub(FEE);
        const POOL_REWARDS_2 = POOL_REWARDS_1.add(REWARDS).sub(FEE);

        const STAKER_1 = accounts[8];
        const STAKER_2 = accounts[7];

        const BALANCE_1_0 = C.BN_BEACON;                          // Staker #1, stage #0
        const BALANCE_1_1 = BALANCE_1_0.add(REWARDS).sub(FEE);  // Staker #1, stage #1
        const BALANCE_2_1 = C.BN_BEACON;                          // Staker #2, stage #1

        const BALANCE_12_2 = BALANCE_1_1.add(BALANCE_2_1).add(REWARDS).sub(FEE); // Staker #1+2, stage #2

        // Deposit some funds first
        await pool.stake({value: C.BN_BEACON, from: STAKER_1});
        await pool.deposit(
            DEPOSIT_DATA[0].PUBKEY, 
            DEPOSIT_DATA[0].WITHDRAW, 
            DEPOSIT_DATA[0].SIGNATURE, 
            DEPOSIT_DATA[0].ROOT);

        // Claim tokens
        await pool.claim({from: STAKER_1});

        // Check token balance before
        assert.equal(await poolToken.balanceOf.call(STAKER_1), BALANCE_1_0.toString());
        assert.equal(await pool.rewards.call(), POOL_REWARDS_0.toString());

        let tx1 = await pool.setRewards(REWARDS, { from: accounts[9] });
        truffleAssert.eventEmitted(tx1, 'RewardsUpdated', (ev) => {
            return ev.oldRewards == POOL_REWARDS_0.toString() && ev.newRewards == POOL_REWARDS_1.toString();
        });

        // Check balances
        assert.equal(await pool.rewards.call(), POOL_REWARDS_1.toString());
        utils.assertAlmostEqual(await poolToken.balanceOf.call(STAKER_1), BALANCE_1_1);

        // Now do another stake
        await pool.stake({value: C.BN_BEACON, from: STAKER_2});
        await pool.deposit(
            DEPOSIT_DATA[3].PUBKEY, 
            DEPOSIT_DATA[3].WITHDRAW, 
            DEPOSIT_DATA[3].SIGNATURE, 
            DEPOSIT_DATA[3].ROOT);

        // Claim tokens
        await pool.claim({from: STAKER_1}); // Claim again, should make no difference
        await pool.claim({from: STAKER_2});

        utils.assertAlmostEqual(await poolToken.balanceOf.call(STAKER_2), BALANCE_2_1);
        
        // Update rewards
        let tx2 = await pool.setRewards(REWARDS.muln(2), { from: accounts[9] });
        truffleAssert.eventEmitted(tx2, 'RewardsUpdated', (ev) => {
            return ev.oldRewards == POOL_REWARDS_1.toString() && ev.newRewards == POOL_REWARDS_2.toString();
        });

        // Check balances
        assert.equal(await pool.rewards.call(), POOL_REWARDS_2.toString());
        let staker_1_balance = await poolToken.balanceOf.call(STAKER_1);
        let staker_2_balance = await poolToken.balanceOf.call(STAKER_2);
        assert(staker_1_balance.gt(BALANCE_1_1));
        assert(staker_2_balance.gt(BALANCE_2_1));
        assert(staker_1_balance.gt(staker_2_balance));
        utils.assertAlmostEqual(staker_1_balance.add(staker_2_balance), BALANCE_12_2);
    });

    it("fail: `setFee` from non-governor", async () => {
        await utils.tryCatch(pool.setFee(40), "Caller is not the governor");
    });

    it("fail: `setFee` fee too high", async () => {
        assert.notEqual(C.FEE_DEFAULT, 10001);
        await pool.setFee(10001, { from: accounts[9] });
        assert.equal(C.FEE_DEFAULT, await pool.fee.call());
    });

    it("success: `setFee`", async () => {
        const FEE_NEW = 2500; // 25%
        let tx = await pool.setFee(FEE_NEW, { from: accounts[9] });
        assert.equal(FEE_NEW, await pool.fee.call());

        truffleAssert.eventEmitted(tx, 'FeeUpdated', (ev) => {
            return ev.oldFee == C.FEE_DEFAULT && ev.newFee == FEE_NEW;
        });
    });
});