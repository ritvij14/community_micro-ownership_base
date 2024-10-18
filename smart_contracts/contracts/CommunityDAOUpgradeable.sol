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
    bytes32 public constant COMMUNITY_ADMIN_ROLE =
        keccak256("COMMUNITY_ADMIN_ROLE");

    enum CommunityType {
        Residential,
        Commercial
    }

    struct Community {
        string name;
        CommunityType communityType;
        address creator;
        address[] members;
        bytes32 adminRole;
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
    ) external {
        _communityIds++;
        uint256 newCommunityId = _communityIds;

        // Create a unique role for this community's admin
        bytes32 communityAdminRole = keccak256(
            abi.encodePacked(COMMUNITY_ADMIN_ROLE, newCommunityId)
        );

        Community storage newCommunity = communities[newCommunityId];
        newCommunity.name = _name;
        newCommunity.communityType = _communityType;
        newCommunity.creator = msg.sender;
        newCommunity.adminRole = communityAdminRole;

        // Grant the community admin role to the creator
        _grantRole(communityAdminRole, msg.sender);

        addMember(newCommunityId, msg.sender);

        emit CommunityCreated(
            newCommunityId,
            _name,
            _communityType,
            msg.sender
        );
    }

    function addMember(uint256 _communityId, address _member) public {
        Community storage community = communities[_communityId];
        require(community.creator != address(0), "Community does not exist");
        require(!isMember(_communityId, _member), "Already a member");
        require(
            hasRole(community.adminRole, msg.sender),
            "Caller is not a community admin"
        );

        community.members.push(_member);
        _grantRole(MEMBER_ROLE, _member);

        governanceToken.safeMint(_member, _communityId);

        emit MemberAdded(_communityId, _member);
    }

    function removeMember(uint256 _communityId, address _member) external {
        Community storage community = communities[_communityId];
        require(community.creator != address(0), "Community does not exist");
        require(isMember(_communityId, _member), "Not a member");
        require(
            hasRole(community.adminRole, msg.sender),
            "Caller is not a community admin"
        );

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

    function isCommunityAdmin(
        uint256 _communityId,
        address _user
    ) public view returns (bool) {
        Community storage community = communities[_communityId];
        return hasRole(community.adminRole, _user);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    event DebugMemberCheck(uint256 communityId, address member, bool isMember);
}
