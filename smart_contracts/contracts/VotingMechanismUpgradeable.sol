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

    enum ProposalType {
        Funding,
        Voting
    }

    struct Proposal {
        uint256 communityId;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed; // Keep this field for storage compatibility
        ProposalType proposalType; // Add the new field
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    // Add a storage gap
    uint256[50] private __gap;

    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed communityId,
        string description,
        uint256 startTime,
        uint256 endTime,
        ProposalType proposalType
    );
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool support
    );

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
        uint256 _votingPeriod,
        ProposalType _proposalType
    ) external returns (uint256) {
        proposalCount++;
        Proposal storage newProposal = proposals[proposalCount];
        newProposal.communityId = _communityId;
        newProposal.description = _description;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + _votingPeriod;
        newProposal.executed = false; // Initialize the executed field
        newProposal.proposalType = _proposalType;

        emit ProposalCreated(
            proposalCount,
            _communityId,
            _description,
            newProposal.startTime,
            newProposal.endTime,
            _proposalType
        );

        return proposalCount;
    }

    function vote(uint256 _proposalId, bool _support) external {
        Proposal storage proposal = proposals[_proposalId];
        require(
            block.timestamp >= proposal.startTime &&
                block.timestamp <= proposal.endTime,
            "Voting is not active"
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
            ProposalType proposalType
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
            proposal.proposalType
        );
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
