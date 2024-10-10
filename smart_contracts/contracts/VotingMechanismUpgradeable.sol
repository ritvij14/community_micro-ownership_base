// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./CommunityDAOUpgradeable.sol";
import "./GovernanceTokenUpgradeable.sol";

contract VotingMechanismUpgradeable is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    CommunityDAOUpgradeable public communityDAO;
    GovernanceTokenUpgradeable public governanceToken;

    struct Proposal {
        uint256 communityId;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed communityId,
        string description,
        uint256 startTime,
        uint256 endTime
    );
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool support
    );
    event ProposalExecuted(uint256 indexed proposalId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _communityDAOAddress,
        address _governanceTokenAddress
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        communityDAO = CommunityDAOUpgradeable(_communityDAOAddress);
        governanceToken = GovernanceTokenUpgradeable(_governanceTokenAddress);
    }

    function createProposal(
        uint256 _communityId,
        string memory _description,
        uint256 _votingPeriod
    ) external {
        require(
            communityDAO.isMember(_communityId, msg.sender),
            "Not a community member"
        );

        proposalCount++;
        Proposal storage newProposal = proposals[proposalCount];
        newProposal.communityId = _communityId;
        newProposal.description = _description;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + _votingPeriod;

        emit ProposalCreated(
            proposalCount,
            _communityId,
            _description,
            newProposal.startTime,
            newProposal.endTime
        );
    }

    function vote(uint256 _proposalId, bool _support) external {
        Proposal storage proposal = proposals[_proposalId];
        require(
            block.timestamp >= proposal.startTime &&
                block.timestamp <= proposal.endTime,
            "Voting is not active"
        );
        require(
            communityDAO.isMember(proposal.communityId, msg.sender),
            "Not a community member"
        );
        require(!proposal.hasVoted[msg.sender], "Already voted");

        proposal.hasVoted[msg.sender] = true;
        if (_support) {
            proposal.forVotes++;
        } else {
            proposal.againstVotes++;
        }

        emit Voted(_proposalId, msg.sender, _support);
    }

    function executeProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(block.timestamp > proposal.endTime, "Voting period not ended");
        require(!proposal.executed, "Proposal already executed");

        proposal.executed = true;

        // Here you would implement the logic to execute the proposal
        // This could involve transferring funds, changing community settings, etc.

        emit ProposalExecuted(_proposalId);
    }

    function getProposalDetails(
        uint256 _proposalId
    )
        external
        view
        returns (
            uint256 communityId,
            string memory description,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 startTime,
            uint256 endTime,
            bool executed
        )
    {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.communityId,
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.startTime,
            proposal.endTime,
            proposal.executed
        );
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
