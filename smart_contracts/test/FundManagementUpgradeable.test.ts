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

    // Create a community
    await communityDAO.connect(owner).createCommunity("Test Community", 0); // 0 for Residential

    // Add addr1 as a member
    await communityDAO.connect(owner).addMember(1, addr1.address);

    // Log membership status for debugging
    console.log(
      "Owner is member:",
      await communityDAO.isMember(1, owner.address)
    );
    console.log(
      "addr1 is member:",
      await communityDAO.isMember(1, addr1.address)
    );
    console.log(
      "Owner is community admin:",
      await communityDAO.isCommunityAdmin(1, owner.address)
    );
  });

  describe("Creating Funding Proposal", function () {
    it("Should create a new funding proposal", async function () {
      const tx = await fundManagement
        .connect(owner)
        .createFundingProposal(
          1,
          "Test Funding Proposal",
          ethers.parseEther("1"),
          86400
        );
      const receipt = await tx.wait();

      const event = receipt!.logs.find(
        (x) =>
          x.topics[0] ===
          fundManagement.interface.getEvent("FundingProposalCreated")!.topicHash
      );
      const decodedEvent = fundManagement.interface.parseLog({
        topics: event!.topics as string[],
        data: event!.data,
      });

      expect(decodedEvent!.args.proposalId).to.equal(1);
      expect(decodedEvent!.args.communityId).to.equal(1);
      expect(decodedEvent!.args.amount).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Contributing Funds", function () {
    beforeEach(async function () {
      console.log("Before creating funding proposal for contribution:");
      console.log("Owner address:", owner.address);
      console.log("Community ID:", 1);
      console.log(
        "Is owner member:",
        await communityDAO.isMember(1, owner.address)
      );
      console.log(
        "Community members:",
        await communityDAO.getCommunityMembers(1)
      );

      await fundManagement
        .connect(owner)
        .createFundingProposal(
          1,
          "Test Funding Proposal",
          ethers.parseEther("1"),
          86400
        );
    });

    it("Should allow contributing funds to a funding proposal", async function () {
      await expect(
        fundManagement
          .connect(owner)
          .contributeFunds(1, { value: ethers.parseEther("0.5") })
      )
        .to.emit(fundManagement, "FundReceived")
        .withArgs(1, ethers.parseEther("0.5"));
    });

    it("Should not allow contributing to non-existent proposals", async function () {
      await expect(
        fundManagement
          .connect(owner)
          .contributeFunds(2, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Not a funding proposal");
    });

    it("Should not allow contributing after the funding period", async function () {
      await ethers.provider.send("evm_increaseTime", [86401]); // Increase time by more than the voting period
      await ethers.provider.send("evm_mine", []); // Mine a new block

      await expect(
        fundManagement
          .connect(owner)
          .contributeFunds(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Funding period not active");
    });
  });
});
