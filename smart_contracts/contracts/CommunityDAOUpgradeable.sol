// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./GovernanceTokenUpgradeable.sol";

contract CommunityDAOUpgradeable is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MEMBER_ROLE = keccak256("MEMBER_ROLE");

    enum CommunityType {
        Residential,
        Commercial
    }

    struct Community {
        string name;
        CommunityType communityType;
        address creator;
        address[] members;
    }

    uint256 private _communityIds;
    mapping(uint256 => Community) private communities;
    GovernanceTokenUpgradeable public governanceToken;

    event CommunityCreated(
        uint256 indexed communityId,
        string name,
        CommunityType communityType,
        address creator
    );
    event MemberAdded(uint256 indexed communityId, address member);
    event MemberRemoved(uint256 indexed communityId, address member);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _governanceTokenAddress) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        governanceToken = GovernanceTokenUpgradeable(_governanceTokenAddress);
    }

    function createCommunity(
        string memory _name,
        CommunityType _communityType
    ) external onlyRole(ADMIN_ROLE) {
        _communityIds++;
        uint256 newCommunityId = _communityIds;

        Community storage newCommunity = communities[newCommunityId];
        newCommunity.name = _name;
        newCommunity.communityType = _communityType;
        newCommunity.creator = msg.sender;

        addMember(newCommunityId, msg.sender);

        emit CommunityCreated(
            newCommunityId,
            _name,
            _communityType,
            msg.sender
        );
    }

    function addMember(
        uint256 _communityId,
        address _member
    ) public onlyRole(ADMIN_ROLE) {
        Community storage community = communities[_communityId];
        require(community.creator != address(0), "Community does not exist");
        require(!isMember(_communityId, _member), "Already a member");

        community.members.push(_member);
        _grantRole(MEMBER_ROLE, _member);

        governanceToken.safeMint(_member, _communityId);

        emit MemberAdded(_communityId, _member);
    }

    function removeMember(
        uint256 _communityId,
        address _member
    ) external onlyRole(ADMIN_ROLE) {
        Community storage community = communities[_communityId];
        require(community.creator != address(0), "Community does not exist");
        require(isMember(_communityId, _member), "Not a member");

        for (uint i = 0; i < community.members.length; i++) {
            if (community.members[i] == _member) {
                community.members[i] = community.members[
                    community.members.length - 1
                ];
                community.members.pop();
                break;
            }
        }

        _revokeRole(MEMBER_ROLE, _member);

        uint256 tokenId = governanceToken.tokenOfOwnerByIndex(_member, 0);
        governanceToken.burn(tokenId);

        emit MemberRemoved(_communityId, _member);
    }

    function getCommunityMembers(
        uint256 _communityId
    ) external view returns (address[] memory) {
        Community storage community = communities[_communityId];
        require(community.creator != address(0), "Community does not exist");
        return community.members;
    }

    function getCommunityDetails(
        uint256 _communityId
    )
        external
        view
        returns (
            string memory name,
            CommunityType communityType,
            address creator,
            uint256 memberCount
        )
    {
        Community storage community = communities[_communityId];
        require(community.creator != address(0), "Community does not exist");
        return (
            community.name,
            community.communityType,
            community.creator,
            community.members.length
        );
    }

    function isMember(
        uint256 _communityId,
        address _member
    ) public view returns (bool) {
        Community storage community = communities[_communityId];
        for (uint i = 0; i < community.members.length; i++) {
            if (community.members[i] == _member) {
                return true;
            }
        }
        return false;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
