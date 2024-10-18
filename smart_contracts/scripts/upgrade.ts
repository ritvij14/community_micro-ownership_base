import { ethers, upgrades } from "hardhat";

async function main() {
  const CommunityDAO = await ethers.getContractFactory(
    "CommunityDAOUpgradeable"
  );
  const FundManagement = await ethers.getContractFactory(
    "FundManagementUpgradeable"
  );
  const VotingMechanism = await ethers.getContractFactory(
    "VotingMechanismUpgradeable"
  );

  // Replace these addresses with your actual proxy addresses
  const communityDAOAddress = "0x86D6AaCDe1a30D634Ff7A41Acab3540ed62430A7";
  const fundManagementAddress = "0x8206E238b2dE3711A005518a0addF9c9e2cf4426";
  const votingMechanismAddress = "0xA7637215687454dA2715905a651B423113d82971";

  console.log("Upgrading CommunityDAO...");
  await upgrades.upgradeProxy(communityDAOAddress, CommunityDAO);
  console.log("CommunityDAO upgraded");

  console.log("Upgrading FundManagement...");
  await upgrades.upgradeProxy(fundManagementAddress, FundManagement);
  console.log("FundManagement upgraded");

  console.log("Upgrading VotingMechanism...");
  await upgrades.upgradeProxy(votingMechanismAddress, VotingMechanism);
  console.log("VotingMechanism upgraded");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
