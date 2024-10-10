import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { GovernanceTokenUpgradeable } from "../typechain-types";

describe("GovernanceTokenUpgradeable", function () {
  let governanceToken: GovernanceTokenUpgradeable;
  let owner: any;
  let addr1: any;
  let addr2: any;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const GovernanceTokenFactory = await ethers.getContractFactory(
      "GovernanceTokenUpgradeable"
    );
    governanceToken = (await upgrades.deployProxy(
      GovernanceTokenFactory,
      []
    )) as unknown as GovernanceTokenUpgradeable;
    await governanceToken.waitForDeployment();
  });

  describe("Minting", function () {
    it("Should mint a new token", async function () {
      await expect(governanceToken.safeMint(addr1.address, 1))
        .to.emit(governanceToken, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 0);
    });

    it("Should mint tokens with increasing IDs", async function () {
      await governanceToken.safeMint(addr1.address, 1);
      await governanceToken.safeMint(addr2.address, 2);
      expect(await governanceToken.ownerOf(0)).to.equal(addr1.address);
      expect(await governanceToken.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should associate the token with the correct community", async function () {
      await governanceToken.safeMint(addr1.address, 1);
      expect(await governanceToken.tokenCommunity(0)).to.equal(1);
    });

    it("Should only allow the owner to mint", async function () {
      await expect(
        governanceToken.connect(addr1).safeMint(addr2.address, 1)
      ).to.be.revertedWithCustomError(
        governanceToken,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await governanceToken.safeMint(addr1.address, 1);
    });

    it("Should burn a token", async function () {
      await expect(governanceToken.connect(addr1).burn(0))
        .to.emit(governanceToken, "Transfer")
        .withArgs(addr1.address, ethers.ZeroAddress, 0);
    });

    it("Should remove the community association when burned", async function () {
      await governanceToken.connect(addr1).burn(0);
      await expect(governanceToken.tokenCommunity(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
    });

    it("Should allow the owner to burn any token", async function () {
      await expect(governanceToken.burn(0))
        .to.emit(governanceToken, "Transfer")
        .withArgs(addr1.address, ethers.ZeroAddress, 0);
    });

    it("Should not allow non-owners to burn tokens they don't own", async function () {
      await expect(governanceToken.connect(addr2).burn(0)).to.be.revertedWith(
        "ERC721: caller is not token owner or approved"
      );
    });
  });

  describe("Token Community", function () {
    it("Should return the correct community ID for a token", async function () {
      await governanceToken.safeMint(addr1.address, 2);
      expect(await governanceToken.tokenCommunity(0)).to.equal(2);
    });

    it("Should revert for non-existent tokens", async function () {
      await expect(governanceToken.tokenCommunity(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
    });
  });

  describe("Upgradeable", function () {
    it("Should initialize with the correct name and symbol", async function () {
      expect(await governanceToken.name()).to.equal("GovernanceToken");
      expect(await governanceToken.symbol()).to.equal("GOVNFT");
    });

    it("Should set the correct owner", async function () {
      expect(await governanceToken.owner()).to.equal(owner.address);
    });
  });
});
