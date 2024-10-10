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

    // Mapping to store community balances (this is a placeholder for actual Safe wallet integration)
    mapping(uint256 => uint256) public communityBalances;

    event FundTransferInitiated(
        uint256 indexed communityId,
        address recipient,
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

    // Function to receive funds for a community
    function receiveFunds(uint256 _communityId) external payable {
        require(
            communityDAO.isMember(_communityId, msg.sender),
            "Not a community member"
        );
        communityBalances[_communityId] += msg.value;
        emit FundReceived(_communityId, msg.value);
    }

    // Function to initiate a fund transfer based on a successful vote
    function initiateFundTransfer(uint256 _proposalId) external {
        (
            uint256 communityId,
            string memory description,
            uint256 forVotes,
            uint256 againstVotes,
            ,
            ,
            bool executed
        ) = votingMechanism.getProposalDetails(_proposalId);
        require(!executed, "Proposal already executed");
        require(forVotes > againstVotes, "Proposal did not pass");

        // Parse the transfer details from the proposal description
        // For simplicity, we assume the description format is "Transfer:address:amount"
        string[] memory parts = split(description, ":");
        require(
            parts.length == 3 &&
                keccak256(abi.encodePacked(parts[0])) ==
                keccak256(abi.encodePacked("Transfer")),
            "Invalid proposal format"
        );

        address recipient = parseAddr(parts[1]);
        uint256 amount = parseInt(parts[2]);

        require(communityBalances[communityId] >= amount, "Insufficient funds");

        // Deduct the amount from the community balance
        communityBalances[communityId] -= amount;

        // Emit an event for the frontend to handle the actual transfer via Safe wallet
        emit FundTransferInitiated(communityId, recipient, amount);

        // Mark the proposal as executed
        votingMechanism.executeProposal(_proposalId);
    }

    // Function to get the current balance of a community
    function getCommunityBalance(
        uint256 _communityId
    ) external view returns (uint256) {
        return communityBalances[_communityId];
    }

    // Helper function to split a string
    function split(
        string memory _base,
        string memory _delimiter
    ) internal pure returns (string[] memory) {
        bytes memory baseBytes = bytes(_base);
        uint count = 1;
        for (uint i = 0; i < baseBytes.length; i++) {
            if (baseBytes[i] == bytes(_delimiter)[0]) {
                count++;
            }
        }
        string[] memory parts = new string[](count);
        count = 0;
        uint lastIndex = 0;
        for (uint i = 0; i < baseBytes.length; i++) {
            if (baseBytes[i] == bytes(_delimiter)[0]) {
                parts[count] = substring(_base, lastIndex, i);
                lastIndex = i + 1;
                count++;
            }
        }
        parts[count] = substring(_base, lastIndex, baseBytes.length);
        return parts;
    }

    // Helper function to get a substring
    function substring(
        string memory _base,
        uint _start,
        uint _end
    ) internal pure returns (string memory) {
        bytes memory _baseBytes = bytes(_base);
        require(_end >= _start, "End must be >= start");
        require(_end <= _baseBytes.length, "End out of bounds");
        bytes memory _temp = new bytes(_end - _start);
        for (uint i = _start; i < _end; i++) {
            _temp[i - _start] = _baseBytes[i];
        }
        return string(_temp);
    }

    // Helper function to parse address from string
    function parseAddr(
        string memory _a
    ) internal pure returns (address _parsedAddress) {
        bytes memory tmp = bytes(_a);
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) {
                b1 -= 87;
            } else if ((b1 >= 65) && (b1 <= 70)) {
                b1 -= 55;
            } else if ((b1 >= 48) && (b1 <= 57)) {
                b1 -= 48;
            }
            if ((b2 >= 97) && (b2 <= 102)) {
                b2 -= 87;
            } else if ((b2 >= 65) && (b2 <= 70)) {
                b2 -= 55;
            } else if ((b2 >= 48) && (b2 <= 57)) {
                b2 -= 48;
            }
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }

    // Helper function to parse uint from string
    function parseInt(
        string memory _a
    ) internal pure returns (uint _parsedInt) {
        return parseInt(_a, 0);
    }

    function parseInt(
        string memory _a,
        uint _b
    ) internal pure returns (uint _parsedInt) {
        bytes memory bresult = bytes(_a);
        uint mint = 0;
        bool decimals = false;
        for (uint i = 0; i < bresult.length; i++) {
            if ((uint8(bresult[i]) >= 48) && (uint8(bresult[i]) <= 57)) {
                if (decimals) {
                    if (_b == 0) break;
                    else _b--;
                }
                mint *= 10;
                mint += uint8(bresult[i]) - 48;
            } else if (uint8(bresult[i]) == 46) decimals = true;
        }
        if (_b > 0) mint *= 10 ** _b;
        return mint;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
