// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./CommunityDAOUpgradeable.sol";
import "./VotingMechanismUpgradeable.sol";

contract FundManagementUpgradeable is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    CommunityDAOUpgradeable public communityDAO;
    VotingMechanismUpgradeable public votingMechanism;
    mapping(uint256 => uint256) public communityBalances;
    uint256[50] private __gap;

    event FundingProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed communityId,
        uint256 amount
    );
    event FundReceived(uint256 indexed communityId, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _communityDAOAddress,
        address _votingMechanismAddress
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        communityDAO = CommunityDAOUpgradeable(_communityDAOAddress);
        votingMechanism = VotingMechanismUpgradeable(_votingMechanismAddress);
    }

    function createFundingProposal(
        uint256 _communityId,
        string memory _description,
        uint256 _amount,
        uint256 _votingPeriod
    ) external {
        uint256 proposalId = votingMechanism.createProposal(
            _communityId,
            _description,
            _votingPeriod,
            VotingMechanismUpgradeable.ProposalType.Funding
        );

        emit FundingProposalCreated(proposalId, _communityId, _amount);
    }

    function contributeFunds(uint256 _proposalId) external payable {
        (
            uint256 communityId,
            ,
            ,
            ,
            uint256 startTime,
            uint256 endTime,
            VotingMechanismUpgradeable.ProposalType proposalType
        ) = votingMechanism.getProposalDetails(_proposalId);

        require(communityId != 0, "Not a funding proposal");
        require(
            proposalType == VotingMechanismUpgradeable.ProposalType.Funding,
            "Not a funding proposal"
        );
        require(
            block.timestamp >= startTime && block.timestamp <= endTime,
            "Funding period not active"
        );
        require(msg.value > 0, "Must contribute some funds");

        emit FundReceived(communityId, msg.value);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
