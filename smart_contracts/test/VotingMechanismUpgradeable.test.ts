import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  CommunityDAOUpgradeable,
  GovernanceTokenUpgradeable,
  VotingMechanismUpgradeable,
} from "../typechain-types";

describe("VotingMechanismUpgradeable", function () {
  let votingMechanism: VotingMechanismUpgradeable;
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

    const VotingMechanismFactory = await ethers.getContractFactory(
      "VotingMechanismUpgradeable"
    );
    votingMechanism = (await upgrades.deployProxy(VotingMechanismFactory, [
      await communityDAO.getAddress(),
      await governanceToken.getAddress(),
    ])) as unknown as VotingMechanismUpgradeable;

    await governanceToken.transferOwnership(await communityDAO.getAddress());

    // Create a community and add members
    await communityDAO.createCommunity("Test Community", 0); // 0 for Residential
    await communityDAO.addMember(1, addr1.address);
  });

  describe("Proposal Creation", function () {
    it("Should create a new voting proposal", async function () {
      const tx = await votingMechanism
        .connect(owner)
        .createProposal(1, "Test Voting Proposal", 86400, 1); // 1 for Voting type
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const expectedEndTime = BigInt(block!.timestamp) + BigInt(86400);

      const event = receipt!.logs.find(
        (x) =>
          x.topics[0] ===
          votingMechanism.interface.getEvent("ProposalCreated")!.topicHash
      );
      const decodedEvent = votingMechanism.interface.parseLog({
        topics: event!.topics as string[],
        data: event!.data,
      });

      expect(decodedEvent!.args.proposalId).to.equal(1);
      expect(decodedEvent!.args.communityId).to.equal(1);
      expect(decodedEvent!.args.description).to.equal("Test Voting Proposal");
      expect(decodedEvent!.args.startTime).to.be.closeTo(
        BigInt(block!.timestamp),
        BigInt(2)
      );
      expect(decodedEvent!.args.endTime).to.be.closeTo(
        expectedEndTime,
        BigInt(2)
      );
      expect(decodedEvent!.args.proposalType).to.equal(1); // Voting type
    });

    it("Should create a new funding proposal", async function () {
      const tx = await votingMechanism
        .connect(owner)
        .createProposal(1, "Test Funding Proposal", 86400, 0); // 0 for Funding type
      const receipt = await tx.wait();
      const decodedEvent = votingMechanism.interface.parseLog({
        topics: receipt!.logs[0].topics as string[],
        data: receipt!.logs[0].data,
      });
      expect(decodedEvent!.args.proposalType).to.equal(0); // Funding type
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      await votingMechanism
        .connect(owner)
        .createProposal(1, "Test Proposal", 86400, 1);
    });

    it("Should not allow double voting", async function () {
      await votingMechanism.connect(owner).vote(1, true);
      await expect(
        votingMechanism.connect(owner).vote(1, false)
      ).to.be.revertedWith("Already voted");
    });

    it("Should not allow voting after the voting period", async function () {
      await ethers.provider.send("evm_increaseTime", [86401]); // Increase time by more than the voting period
      await ethers.provider.send("evm_mine", []); // Mine a new block

      await expect(
        votingMechanism.connect(owner).vote(1, true)
      ).to.be.revertedWith("Voting is not active");
    });
  });

  describe("Get Proposal Details", function () {
    beforeEach(async function () {
      await votingMechanism
        .connect(owner)
        .createProposal(1, "Test Proposal", 86400, 1);
    });

    it("Should return correct proposal details", async function () {
      const proposalDetails = await votingMechanism.getProposalDetails(1);
      expect(proposalDetails.communityId).to.equal(1);
      expect(proposalDetails.description).to.equal("Test Proposal");
      expect(proposalDetails.forVotes).to.equal(0);
      expect(proposalDetails.againstVotes).to.equal(0);
      expect(proposalDetails.proposalType).to.equal(1); // Voting type
    });

    it("Should return updated vote counts after voting", async function () {
      await votingMechanism.connect(owner).vote(1, true);
      await votingMechanism.connect(addr1).vote(1, false);

      const proposalDetails = await votingMechanism.getProposalDetails(1);
      expect(proposalDetails.forVotes).to.equal(1);
      expect(proposalDetails.againstVotes).to.equal(1);
    });
  });
});
