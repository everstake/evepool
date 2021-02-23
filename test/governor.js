const PoolToken = artifacts.require("PoolToken");
const Pool = artifacts.require("Pool");
const DepositContract = artifacts.require("DepositContract");
const Governor = artifacts.require("Governor");
const utils = require("./_test_utils.js");
const truffleAssert = require('truffle-assertions');
const BN = require('bn.js');
const C = require("./_const.js");
const DEPOSIT_DATA = require("./_const.js").DEPOSIT_DATA;

const PROPOSAL = {
    SetRewards: 0, SetFee: 1, AddOracle: 2, RemoveOracle: 3, INVALID: 4,
};

contract("Governor", async accounts => {

    let poolToken;
    let depositContract;
    let pool;
    let governor;

    beforeEach(async () => {
        poolToken = await PoolToken.new();
        await poolToken.initialize();
        depositContract = await DepositContract.new();
        pool = await Pool.new();
        await pool.initialize(poolToken.address, depositContract.address, C.FEE_DEFAULT);
        governor = await Governor.new();
        await governor.initialize(pool.address);

        // Set PoolToken owner to the Pool
        await poolToken.transferOwnership(pool.address);

        // Set pool governor
        await pool.setGovernor(governor.address);
    });

    it("success: initialization", async () => {
        assert.equal(await governor.oracleCount.call(), 1);
        assert.equal(await governor.oracle.call(0), accounts[0]);
        await utils.tryCatch(governor.oracle.call(1), "Invalid index");
    });

    it("success: overall proposing, voting and quorum", async () => {
        let tx1 = await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[1]), { from: accounts[0] });

        truffleAssert.eventEmitted(tx1, 'ProposalCreated', (ev) => {
            return ev.proposalId == 1 && 
                ev.author == accounts[0] && 
                ev.proposalType == PROPOSAL.AddOracle && 
                ev.arg == utils.addressToBytes32(accounts[1]);
        });
        truffleAssert.eventEmitted(tx1, 'ProposalVoted', (ev) => {
            return ev.proposalId == 1 && ev.oracle == accounts[0];
        });
        truffleAssert.eventEmitted(tx1, 'ProposalExecuted', (ev) => {
            return ev.proposalId == 1 && 
                ev.proposalType == PROPOSAL.AddOracle && 
                ev.arg == utils.addressToBytes32(accounts[1]);
        });    

        assert.equal(await governor.proposalCount.call(), 1);

        // Single oracle gets approved instantly
        await utils.tryCatch(governor.getProposal.call(1), "Proposal does not exist"); 

        // Check if oracle was added
        assert.equal(await governor.oracleCount.call(), 2);
        assert.equal(await governor.oracle.call(1), accounts[1]);

        // Send proposal from the new oracle
        let tx2 = await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[2]), { from: accounts[1] });
        truffleAssert.eventEmitted(tx2, 'ProposalCreated', (ev) => {
            return ev.proposalId == 2 && 
                ev.author == accounts[1] && 
                ev.proposalType == PROPOSAL.AddOracle && 
                ev.arg == utils.addressToBytes32(accounts[2]);
        });
        truffleAssert.eventEmitted(tx2, 'ProposalVoted', (ev) => {
            return ev.proposalId == 2 && ev.oracle == accounts[1];
        });
        truffleAssert.eventNotEmitted(tx2, 'ProposalExecuted', (ev) => {
            return ev.proposalId == 2 && 
                ev.proposalType == PROPOSAL.AddOracle && 
                ev.arg == utils.addressToBytes32(accounts[2]);
        }); 

        // This one waits for the second vote
        assert.equal(await governor.proposalCount.call(), 2);
        let proposal = await governor.getProposal.call(2);
        assert.equal(proposal.proposalType, 2);
        assert.equal(proposal.author, accounts[1]);
        assert.equal(proposal.arg, utils.addressToBytes32(accounts[2]));
        assert.equal(proposal.voteCount, 1);

        // Now vote for the proposal by author (does not change anything)
        await governor.vote(2, { from: accounts[1] });
        proposal = await governor.getProposal.call(2);
        assert.equal(proposal.voteCount, 1);

        // Propser vote by the first oracle executes the proposal
        await governor.vote(2, { from: accounts[0] });
        await utils.tryCatch(governor.getProposal.call(2), "Proposal does not exist"); 
        assert.equal(await governor.oracleCount.call(), 3);

        // Another proposal approved by 2 votes of 3
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[3]), { from: accounts[2] });
        await governor.vote(3, { from: accounts[0] });
        assert.equal(await governor.oracleCount.call(), 4);
    });

    it("fail: `propose` by non-oracle", async () => {
        await utils.tryCatch(governor.propose(PROPOSAL.SetRewards, utils.intToBytes32(0), {from: accounts[1]}), "Caller is not an Oracle");
    });

    it("fail: `propose` with invalid proposal", async () => {
        await utils.tryCatch(governor.propose(PROPOSAL.INVALID, utils.intToBytes32(0), {from: accounts[0]}), "invalid opcode", "");
    });

    it("fail: `propose` by oracle with valid proposal", async () => {
        // Add second oracle
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[1]), { from: accounts[0] });

        // Propose and wait for the second vote
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[2]), { from: accounts[0] });

        // Repeat proposal fail
        await utils.tryCatch(governor.propose(PROPOSAL.SetRewards, utils.intToBytes32(0), {from: accounts[0]}), "Oracle has an active proposal");
    });

    it("success: `cancel`", async () => {
        // Add second oracle
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[1]), { from: accounts[0] });

        // Propose and wait for the second vote
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[2]), { from: accounts[0] });

        // Now cancel the proposal
        let tx = await governor.cancel(2, { from: accounts[0] });
        await utils.tryCatch(governor.getProposal.call(2), "Proposal does not exist"); 

        truffleAssert.eventEmitted(tx, 'ProposalCanceled', (ev) => {
            return ev.proposalId == 2;
        });
    });

    it("fail: `cancel` by non-oracle and non-author", async () => {
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[1]), { from: accounts[0] });
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[2]), { from: accounts[0] });

        // Non-oracle cancel
        await utils.tryCatch(governor.cancel(2, { from: accounts[2] }), "Caller is not an Oracle");
        // Non-author cancel
        await utils.tryCatch(governor.cancel(2, { from: accounts[1] }), "Caller is not the author");
    });

    it("fail: `cancel` inactive proposal", async () => {
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[1]), { from: accounts[0] });
        await utils.tryCatch(governor.cancel(1, { from: accounts[0] }), "Proposal does not exist"); 
    });

    it("fail: `vote` by non-oracle", async () => {
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[1]), { from: accounts[0] });
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[2]), { from: accounts[0] });

        // Non-oracle vote
        await utils.tryCatch(governor.vote(2, { from: accounts[2] }), "Caller is not an Oracle");
    });

    it("fail: `vote` inactive proposal", async () => {
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[1]), { from: accounts[0] });
        await utils.tryCatch(governor.vote(1, { from: accounts[0] }), "Proposal does not exist"); 
    });

    it("fail: reward change on empty pool", async () => {
        await utils.tryCatch(governor.propose(PROPOSAL.SetRewards, utils.intToBytes32(100), { from: accounts[0] }),
            "Ratio cannot be 0");
    });

    it("success: reward change", async () => {
        // Stake some funds first
        await pool.stake({value: C.BN_BEACON, from: accounts[2]});
        let tx = await pool.deposit(
            DEPOSIT_DATA[0].PUBKEY, 
            DEPOSIT_DATA[0].WITHDRAW, 
            DEPOSIT_DATA[0].SIGNATURE, 
            DEPOSIT_DATA[0].ROOT);

        // Claim tokens
        await pool.claim({from: accounts[2]});
            
        const REWARDS = C.BN_ETH.muln(2);
        const REWARDS32 = utils.bnToBytes32(REWARDS);
        await governor.propose(PROPOSAL.SetRewards, REWARDS32, { from: accounts[0] });

        assert.equal((await pool.rewards.call()).toString(), REWARDS.sub(REWARDS.divn(100)));
    });

    it("success: fee change", async () => {
        const NEW_FEE = 1000; // 10%
        assert.notEqual(C.FEE_DEFAULT, NEW_FEE);
        await governor.propose(PROPOSAL.SetFee, utils.intToBytes32(1000), { from: accounts[0] });

        assert.equal((await pool.fee.call()).toString(), NEW_FEE);
    });

    it("success: remove oracle", async () => {
        // First add the oracle
        await governor.propose(PROPOSAL.AddOracle, utils.addressToBytes32(accounts[1]), { from: accounts[0] });

        // Check if oracle is added
        assert.equal(await governor.oracleCount.call(), 2);
        assert.equal(await governor.oracle.call(1), accounts[1]);

        // Propose and vote removal
        await governor.propose(PROPOSAL.RemoveOracle, utils.addressToBytes32(accounts[0]), { from: accounts[0] });
        await governor.vote(2, { from: accounts[1] });

        // Check if oracle is removed
        assert.equal(await governor.oracleCount.call(), 1);
        assert.equal(await governor.oracle.call(0), accounts[1]);
    });
});