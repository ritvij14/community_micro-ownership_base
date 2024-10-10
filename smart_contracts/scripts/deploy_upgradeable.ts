import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy GovernanceTokenUpgradeable
  const GovernanceToken = await ethers.getContractFactory(
    "GovernanceTokenUpgradeable"
  );
  const governanceToken = await upgrades.deployProxy(GovernanceToken, []);
  await governanceToken.waitForDeployment();
  console.log(
    "GovernanceTokenUpgradeable deployed to:",
    await governanceToken.getAddress()
  );

  // Deploy CommunityDAOUpgradeable
  const CommunityDAO = await ethers.getContractFactory(
    "CommunityDAOUpgradeable"
  );
  const communityDAO = await upgrades.deployProxy(CommunityDAO, [
    await governanceToken.getAddress(),
  ]);
  await communityDAO.waitForDeployment();
  console.log(
    "CommunityDAOUpgradeable deployed to:",
    await communityDAO.getAddress()
  );

  // Deploy VotingMechanismUpgradeable
  const VotingMechanism = await ethers.getContractFactory(
    "VotingMechanismUpgradeable"
  );
  const votingMechanism = await upgrades.deployProxy(VotingMechanism, [
    await communityDAO.getAddress(),
    await governanceToken.getAddress(),
  ]);
  await votingMechanism.waitForDeployment();
  console.log(
    "VotingMechanismUpgradeable deployed to:",
    await votingMechanism.getAddress()
  );

  // Deploy FundManagementUpgradeable
  const FundManagement = await ethers.getContractFactory(
    "FundManagementUpgradeable"
  );
  const fundManagement = await upgrades.deployProxy(FundManagement, [
    await communityDAO.getAddress(),
    await votingMechanism.getAddress(),
  ]);
  await fundManagement.waitForDeployment();
  console.log(
    "FundManagementUpgradeable deployed to:",
    await fundManagement.getAddress()
  );

  // Transfer ownership of GovernanceToken to CommunityDAO
  await governanceToken.transferOwnership(await communityDAO.getAddress());
  console.log("GovernanceToken ownership transferred to CommunityDAO");

  // Additional setup steps if needed
  // For example, granting roles, setting up initial communities, etc.
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
