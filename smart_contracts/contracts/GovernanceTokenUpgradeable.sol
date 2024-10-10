// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract GovernanceTokenUpgradeable is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    uint256 private _nextTokenId;

    // Mapping from token ID to community ID
    mapping(uint256 => uint256) private _tokenCommunities;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC721_init("GovernanceToken", "GOVNFT");
        __ERC721Enumerable_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function safeMint(address to, uint256 communityId) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _tokenCommunities[tokenId] = communityId;
    }

    function burn(uint256 tokenId) public {
        require(
            ownerOf(tokenId) == msg.sender || msg.sender == owner(),
            "ERC721: caller is not token owner or approved"
        );
        delete _tokenCommunities[tokenId];
        _burn(tokenId);
    }

    function tokenCommunity(uint256 tokenId) public view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "ERC721: invalid token ID");
        return _tokenCommunities[tokenId];
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function burnFrom(uint256 tokenId) public onlyOwner {
        _burn(tokenId);
        delete _tokenCommunities[tokenId];
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
