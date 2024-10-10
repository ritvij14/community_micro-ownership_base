import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  CommunityDAOUpgradeable,
  GovernanceTokenUpgradeable,
} from "../typechain-types";

describe("CommunityDAOUpgradeable", function () {
  let communityDAO: CommunityDAOUpgradeable;
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

    const CommunityDAOFactory = await ethers.getContractFactory(
      "CommunityDAOUpgradeable"
    );
    communityDAO = (await upgrades.deployProxy(CommunityDAOFactory, [
      await governanceToken.getAddress(),
    ])) as unknown as CommunityDAOUpgradeable;

    // Grant minter role to CommunityDAO
    await governanceToken.transferOwnership(await communityDAO.getAddress());
  });

  describe("Community Creation", function () {
    it("Should create a new community", async function () {
      await expect(communityDAO.createCommunity("Test Community", 0)) // 0 for Residential
        .to.emit(communityDAO, "CommunityCreated")
        .withArgs(1, "Test Community", 0, owner.address);
    });

    it("Should make the creator a member and mint a token", async function () {
      await communityDAO.createCommunity("Test Community", 0);
      const members = await communityDAO.getCommunityMembers(1);
      expect(members).to.include(owner.address);
      expect(await governanceToken.balanceOf(owner.address)).to.equal(1);
    });
  });

  describe("Adding Members", function () {
    beforeEach(async function () {
      await communityDAO.createCommunity("Test Community", 0);
    });

    it("Should add a new member and mint a token", async function () {
      await expect(communityDAO.addMember(1, addr1.address))
        .to.emit(communityDAO, "MemberAdded")
        .withArgs(1, addr1.address);
      expect(await governanceToken.balanceOf(addr1.address)).to.equal(1);
    });

    it("Should not allow adding an existing member", async function () {
      await communityDAO.addMember(1, addr1.address);
      await expect(communityDAO.addMember(1, addr1.address)).to.be.revertedWith(
        "Already a member"
      );
    });
  });

  describe("Removing Members", function () {
    beforeEach(async function () {
      await communityDAO.createCommunity("Test Community", 0);
      await communityDAO.addMember(1, addr1.address);
    });

    it("Should remove a member and burn their token", async function () {
      await expect(communityDAO.removeMember(1, addr1.address))
        .to.emit(communityDAO, "MemberRemoved")
        .withArgs(1, addr1.address);
      expect(await governanceToken.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should not allow removing a non-member", async function () {
      await expect(
        communityDAO.removeMember(1, addr2.address)
      ).to.be.revertedWith("Not a member");
    });
  });

  describe("Get Community Members", function () {
    beforeEach(async function () {
      await communityDAO.createCommunity("Test Community", 0);
      await communityDAO.addMember(1, addr1.address);
    });

    it("Should return all members of a community", async function () {
      const members = await communityDAO.getCommunityMembers(1);
      expect(members).to.have.lengthOf(2);
      expect(members).to.include(owner.address);
      expect(members).to.include(addr1.address);
    });

    it("Should revert for non-existent community", async function () {
      await expect(communityDAO.getCommunityMembers(2)).to.be.revertedWith(
        "Community does not exist"
      );
    });
  });

  describe("Get Community Details", function () {
    it("Should return correct community details", async function () {
      await communityDAO.createCommunity("Test Community", 0);
      const details = await communityDAO.getCommunityDetails(1);
      expect(details.name).to.equal("Test Community");
      expect(details.communityType).to.equal(0); // 0 for Residential
      expect(details.creator).to.equal(owner.address);
      expect(details.memberCount).to.equal(1);
    });
  });

  describe("Check Membership", function () {
    beforeEach(async function () {
      await communityDAO.createCommunity("Test Community", 0);
      await communityDAO.addMember(1, addr1.address);
    });

    it("Should return true for members", async function () {
      expect(await communityDAO.isMember(1, owner.address)).to.be.true;
      expect(await communityDAO.isMember(1, addr1.address)).to.be.true;
    });

    it("Should return false for non-members", async function () {
      expect(await communityDAO.isMember(1, addr2.address)).to.be.false;
    });
  });
});
