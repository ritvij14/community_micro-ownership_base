import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  CommunityDAOUpgradeable,
  FundManagementUpgradeable,
  GovernanceTokenUpgradeable,
  VotingMechanismUpgradeable,
} from "../typechain-types";

describe("FundManagementUpgradeable", function () {
  let fundManagement: FundManagementUpgradeable;
  let communityDAO: CommunityDAOUpgradeable;
  let governanceToken: GovernanceTokenUpgradeable;
  let votingMechanism: VotingMechanismUpgradeable;
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

    const VotingMechanismFactory = await ethers.getContractFactory(
      "VotingMechanismUpgradeable"
    );
    votingMechanism = (await upgrades.deployProxy(VotingMechanismFactory, [
      await communityDAO.getAddress(),
      await governanceToken.getAddress(),
    ])) as unknown as VotingMechanismUpgradeable;

    const FundManagementFactory = await ethers.getContractFactory(
      "FundManagementUpgradeable"
    );
    fundManagement = (await upgrades.deployProxy(FundManagementFactory, [
      await communityDAO.getAddress(),
      await votingMechanism.getAddress(),
    ])) as unknown as FundManagementUpgradeable;

    await governanceToken.transferOwnership(await communityDAO.getAddress());

    // Create a community and add members
    await communityDAO.createCommunity("Test Community", 0); // 0 for Residential
    await communityDAO.addMember(1, addr1.address);
  });

  describe("Receiving Funds", function () {
    it("Should allow community members to send funds", async function () {
      await expect(
        fundManagement
          .connect(owner)
          .receiveFunds(1, { value: ethers.parseEther("1") })
      )
        .to.emit(fundManagement, "FundReceived")
        .withArgs(1, ethers.parseEther("1"));

      expect(await fundManagement.getCommunityBalance(1)).to.equal(
        ethers.parseEther("1")
      );
    });

    it("Should not allow non-members to send funds", async function () {
      await expect(
        fundManagement
          .connect(addr2)
          .receiveFunds(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Not a community member");
    });
  });

  describe("Initiating Fund Transfer", function () {
    beforeEach(async function () {
      await fundManagement
        .connect(owner)
        .receiveFunds(1, { value: ethers.parseEther("2") });
      await votingMechanism
        .connect(owner)
        .createProposal(
          1,
          `Transfer:${addr2.address}:${ethers.parseEther("1")}`,
          1
        );
      await votingMechanism.connect(owner).vote(1, true);
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
    });

    it("Should initiate fund transfer for passed proposals", async function () {
      await expect(fundManagement.initiateFundTransfer(1))
        .to.emit(fundManagement, "FundTransferInitiated")
        .withArgs(1, addr2.address, ethers.parseEther("1"));

      expect(await fundManagement.getCommunityBalance(1)).to.equal(
        ethers.parseEther("1")
      );
    });

    it("Should not initiate transfer if proposal didn't pass", async function () {
      await votingMechanism
        .connect(owner)
        .createProposal(
          1,
          `Transfer:${addr2.address}:${ethers.parseEther("1")}`,
          1
        );
      await votingMechanism.connect(owner).vote(2, false);
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await expect(fundManagement.initiateFundTransfer(2)).to.be.revertedWith(
        "Proposal did not pass"
      );
    });

    it("Should not initiate transfer if insufficient funds", async function () {
      await votingMechanism
        .connect(owner)
        .createProposal(
          1,
          `Transfer:${addr2.address}:${ethers.parseEther("3")}`,
          1
        );
      await votingMechanism.connect(owner).vote(2, true);
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await expect(fundManagement.initiateFundTransfer(2)).to.be.revertedWith(
        "Insufficient funds"
      );
    });
  });
});
