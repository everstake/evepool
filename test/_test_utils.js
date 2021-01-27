const BN = require('bn.js');

const PREFIX = "Returned error: VM Exception while processing transaction:";

module.exports.tryCatch = async function(promise, errText, errType = "revert") {
    try {
        await promise;
        throw null;
    }
    catch (error) {
        assert(error, "Expected an error but did not get one");
        if (errType) {
            errType = " " + errType;
        }
        let expected = `${PREFIX}${errType} ${errText}`;
        assert(error.message.startsWith(expected), `Expected an error starting with '${expected}' but got '${error.message}' instead`);
    }
};

module.exports.getTransactionFee = async function(txInfo) {
    const tx = await web3.eth.getTransaction(txInfo.tx);
    const gasCost = new BN(tx.gasPrice).mul(new BN(txInfo.receipt.gasUsed));
    return gasCost;
};

module.exports.assertAlmostEqual = function(n1, n2) {
    let diff = n1.sub(n2).toNumber();
    assert.closeTo(diff, 0, 1);
}

module.exports.intToBytes32 = function(n) {
    return '0x' + new BN(n).toString(16, 64);
}

module.exports.bnToBytes32 = function(n) {
    return '0x' + n.toString(16, 64);
}

module.exports.addressToBytes32 = function(n) {
    return '0x000000000000000000000000' + Buffer.from(n.slice(2), 'hex').toString('hex');
}