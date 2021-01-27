// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "openzeppelin-solidity/contracts/utils/EnumerableSet.sol";
import "./interfaces/IPool.sol";

contract Governor {
    using EnumerableSet for EnumerableSet.AddressSet;

    event ProposalCreated(
        uint256 proposalId,
        address author,
        ProposalType proposalType,
        bytes32 arg
    );
    event ProposalCanceled(uint256 proposalId);
    event ProposalVoted(uint256 proposalId, address oracle);
    event ProposalExecuted(
        uint256 proposalId,
        ProposalType proposalType,
        bytes32 arg
    );

    enum ProposalType {SetRewards, SetFee, AddOracle, RemoveOracle}

    struct Proposal {
        ProposalType proposalType;
        address author;
        bytes32 arg;
        uint256 voteCount;
        mapping(address => bool) votes;
    }

    EnumerableSet.AddressSet private _oracles;

    uint256 private _proposalCount = 0;
    mapping(uint256 => Proposal) private _proposals;
    mapping(address => uint256) private _oracleProposals;

    IPool private _pool;

    modifier onlyOracle() {
        require(_oracles.contains(msg.sender), "Caller is not an Oracle");
        _;
    }

    constructor(IPool pool) public {
        _pool = pool;

        // Add contract creator as a default oracle
        _oracles.add(msg.sender);
    }

    function oracleCount() external view returns (uint256) {
        return _oracles.length();
    }

    function oracle(uint256 index) external view returns (address) {
        require(index < _oracles.length(), "Invalid index");
        return _oracles.at(index);
    }

    function propose(
        ProposalType proposalType,
        bytes32 arg
    ) external onlyOracle {
        _propose(proposalType, arg, msg.sender);
    }

    function cancel(uint256 proposalId) external onlyOracle {
        _cancel(proposalId, msg.sender);
    }

    function vote(uint256 proposalId) external onlyOracle {
        _vote(proposalId, msg.sender);
    }

    function executeProposal(uint256 proposalId) external onlyOracle {
        require(_executeProposal(proposalId), "No quorum");
    }

    function proposalCount() external view returns (uint256) {
        return _proposalCount;
    }

    function getProposal(uint256 proposalId)
        external
        view
        returns (
            ProposalType proposalType,
            address author,
            bytes32 arg,
            uint256 voteCount
        )
    {
        Proposal storage proposal = _getProposal(proposalId);
        return (
            proposal.proposalType,
            proposal.author,
            proposal.arg,
            proposal.voteCount
        );
    }

    function getVote(uint256 proposalId, address voter)
        external
        view
        returns (bool)
    {
        Proposal storage proposal = _getProposal(proposalId);
        return proposal.votes[voter];
    }

    function _getProposal(uint256 proposalId)
        private
        view
        returns (Proposal storage)
    {
        Proposal storage proposal = _proposals[proposalId];
        require(proposal.author != address(0), "Proposal does not exist");
        return proposal;
    }

    function _propose(
        ProposalType proposalType,
        bytes32 arg,
        address byOracle
    ) private {
        require(_oracleProposals[byOracle] == 0, "Oracle has an active proposal");

        _proposalCount++;
        Proposal memory newProposal =
            Proposal({
                proposalType: proposalType,
                author: byOracle,
                arg: arg,
                voteCount: 0
            });

        _proposals[_proposalCount] = newProposal;
        _oracleProposals[byOracle] = _proposalCount;

        emit ProposalCreated(
            _proposalCount,
            byOracle,
            proposalType,
            arg
        );

        _vote(_proposalCount, byOracle);
    }

    function _cancel(uint256 proposalId, address author) private {
        Proposal storage proposal = _getProposal(proposalId);
        require(proposal.author == author, "Caller is not the author");

        // Clear up proposal
        delete _oracleProposals[proposal.author];
        delete _proposals[proposalId];

        emit ProposalCanceled(proposalId);
    }

    function _vote(uint256 proposalId, address byOracle) private {
        Proposal storage proposal = _getProposal(proposalId);
        if (!proposal.votes[byOracle]) {
            proposal.votes[byOracle] = true;
            proposal.voteCount++;
        }
        emit ProposalVoted(proposalId, byOracle);

        _executeProposal(proposalId);
    }

    function _executeProposal(uint256 proposalId) private returns (bool) {
        Proposal storage proposal = _getProposal(proposalId);
        if (!_hasQuorum(proposal.voteCount, _oracles.length())) {
            return false;
        }

        if (proposal.proposalType == ProposalType.SetRewards) {
            // Set rewards in the pool contract
            _pool.setRewards(uint256(proposal.arg));
        } else if (proposal.proposalType == ProposalType.SetFee) {
            // Set fee in the pool contract
            _pool.setFee(uint256(proposal.arg));
        } else if (proposal.proposalType == ProposalType.AddOracle) {
            // Add Oracle to the list
            _oracles.add(address(uint160(uint256(proposal.arg))));
        } else if (proposal.proposalType == ProposalType.RemoveOracle) {
            // Remove oracle from the list
            require(_oracles.length() > 1, "Cannot delete last oracle");
            _oracles.remove(address(uint160(uint256(proposal.arg))));
        } else {
            revert("Unknown proposal type");
        }

        emit ProposalExecuted(
            proposalId,
            proposal.proposalType,
            proposal.arg
        );

        // Clear up proposal
        delete _oracleProposals[proposal.author];
        delete _proposals[proposalId];

        return true;
    }

    function _hasQuorum(uint256 votes, uint256 oracles)
        private
        pure
        returns (bool)
    {
        uint256 requiredVotes = oracles - oracles / 3;
        bool result = requiredVotes <= votes;
        return result;
    }   
}
