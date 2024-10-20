import { ethers } from "ethers";
import CommunityDAOABI from "../contract_abi/CommunityDAOUpgradeable.json";
import FundManagementABI from "../contract_abi/FundManagementUpgradeable.json";
import GovernanceTokenABI from "../contract_abi/GovernanceTokenUpgradeable.json";
import VotingMechanismABI from "../contract_abi/VotingMechanismUpgradeable.json";
import {
  createSafeWallet,
  transferFunds as safeTransferFunds,
} from "./safeWallet";

const GovernanceTokenAddress = "0x2D250e173172F0C67763bb70ed4a2C59273856a2";
const CommunityDAOAddress = "0x86D6AaCDe1a30D634Ff7A41Acab3540ed62430A7";
const VotingMechanismAddress = "0xA7637215687454dA2715905a651B423113d82971";
const FundManagementAddress = "0x8206E238b2dE3711A005518a0addF9c9e2cf4426";

const BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";

let governanceToken: ethers.Contract;
let communityDAO: ethers.Contract;
let votingMechanism: ethers.Contract;
let fundManagement: ethers.Contract;
let signer: ethers.Signer;

// Add this function at the top of the file
async function checkBalance(address: string) {
  if (!signer || !signer.provider) {
    throw new Error("Signer or provider not initialized");
  }
  const balance = await signer.provider.getBalance(address);
  console.log(
    `Balance of ${address}: ${ethers.utils.formatEther(balance)} ETH`
  );
  return balance;
}

export async function initializeContracts(privyProvider?: any) {
  if (!privyProvider) {
    console.warn("No provider supplied to initializeContracts");
    return;
  }

  try {
    const provider = new ethers.providers.Web3Provider(privyProvider);
    signer = provider.getSigner();

    governanceToken = new ethers.Contract(
      GovernanceTokenAddress,
      GovernanceTokenABI.abi,
      signer
    );
    communityDAO = new ethers.Contract(
      CommunityDAOAddress,
      CommunityDAOABI.abi,
      signer
    );
    votingMechanism = new ethers.Contract(
      VotingMechanismAddress,
      VotingMechanismABI.abi,
      signer
    );
    fundManagement = new ethers.Contract(
      FundManagementAddress,
      FundManagementABI.abi,
      signer
    );

    console.log("Contracts initialized successfully");
  } catch (error) {
    console.error("Error initializing contracts:", error);
    throw error;
  }
}

export async function mintMembershipNFT(communityId: string) {
  if (!governanceToken || !signer) {
    throw new Error("Contracts not initialized");
  }

  try {
    const communityIdBN = ethers.BigNumber.from(communityId);
    const tx = await governanceToken.safeMint(
      await signer.getAddress(),
      communityIdBN
    );
    const receipt = await tx.wait();
    const tokenId = receipt.events[0].args.tokenId.toNumber();
    return tokenId;
  } catch (error) {
    console.error("Error minting membership NFT:", error);
    throw error;
  }
}

export async function createCommunityOnChain(
  name: string,
  description: string,
  type: "residential" | "commercial"
) {
  if (!communityDAO || !signer) {
    throw new Error("Contracts not initialized");
  }

  try {
    const communityType = type === "residential" ? 0 : 1;
    console.log("Creating community with params:", { name, communityType });

    const signerAddress = await signer.getAddress();
    console.log("Signer address:", signerAddress);
    console.log("CommunityDAO contract address:", CommunityDAOAddress);

    // Use a fixed gas limit instead of estimating
    const gasLimit = 500000; // Adjust this value if needed

    const tx = await communityDAO.createCommunity(name, communityType, {
      gasLimit: gasLimit,
    });
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction mined:", receipt.transactionHash);

    const event = receipt.events.find(
      (e: { event: string }) => e.event === "CommunityCreated"
    );
    if (!event) {
      throw new Error(
        "CommunityCreated event not found in transaction receipt"
      );
    }

    const communityId = event.args.communityId.toString();
    return communityId;
  } catch (error: any) {
    console.error("Detailed error in createCommunity:", error);
    throw new Error(`Failed to create community: ${error.message}`);
  }
}

export async function createVotingProposalOnChain(
  communityId: string,
  description: string,
  votingPeriod: string,
  proposalType: number
): Promise<string> {
  if (!votingMechanism || !signer) {
    throw new Error("Contracts not initialized");
  }

  try {
    // Convert communityId to BigNumber
    const communityIdBN = ethers.BigNumber.from(communityId);
    const proposalTypeBN = ethers.BigNumber.from(proposalType);

    // Use a fixed gas limit instead of estimating
    const gasLimit = 500000; // Adjust this value if needed

    // Check if the user is a member of the community
    const isMember = await communityDAO.isMember(
      communityIdBN,
      await signer.getAddress()
    );
    console.log("Is user a member of the community?", isMember);

    if (!isMember) {
      throw new Error("User is not a member of the community");
    }

    console.log("Creating proposal with params:", {
      communityIdBN,
      description,
      votingPeriod: ethers.BigNumber.from(votingPeriod),
      proposalTypeBN,
    });

    const tx = await votingMechanism.createProposal(
      communityIdBN,
      description,
      ethers.BigNumber.from(votingPeriod),
      proposalTypeBN,
      { gasLimit }
    );
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction mined:", receipt.transactionHash);

    const event = receipt.events.find(
      (e: any) => e.event === "ProposalCreated"
    );
    if (!event) {
      throw new Error("ProposalCreated event not found in transaction receipt");
    }

    const proposalId = event.args.proposalId.toString();
    return proposalId;
  } catch (error: any) {
    console.error("Detailed error in createProposal:", error);
    return "";
  }
}

export async function voteOnProposal(proposalId: string, support: boolean) {
  if (!votingMechanism || !signer) {
    throw new Error("Contracts not initialized");
  }

  try {
    const tx = await votingMechanism.vote(
      ethers.BigNumber.from(proposalId),
      support
    );
    await tx.wait();
  } catch (error) {
    console.error("Error voting on proposal:", error);
    throw error;
  }
}

export async function executeProposal(proposalId: string) {
  if (!fundManagement || !signer) {
    throw new Error("Contracts not initialized");
  }

  try {
    const tx = await fundManagement.contributeFunds(proposalId);
    await tx.wait();
    return true;
  } catch (error) {
    console.error("Error executing proposal:", error);
    return false;
  }
}

export async function transferFunds(
  communityId: string,
  amount: ethers.BigNumberish,
  recipient: string
): Promise<string> {
  if (!communityDAO || !fundManagement) {
    throw new Error("Contracts not initialized");
  }

  try {
    const community = await communityDAO.getCommunity(communityId);
    let safeAddress = community.safeWalletAddress;

    if (!safeAddress) {
      // Create a new Safe wallet if it doesn't exist
      const owners = community.memberIds; // Assuming memberIds are wallet addresses
      safeAddress = await createSafeWallet(
        owners,
        Math.ceil(owners.length / 2)
      ); // Set threshold to majority

      // Update community with new Safe wallet address
      await communityDAO.updateCommunitySafeWallet(communityId, safeAddress);
    }

    // Transfer funds using Safe wallet
    const txHash = await safeTransferFunds(
      safeAddress,
      recipient,
      amount.toString()
    );

    // Update fund balance in the smart contract
    await fundManagement.updateFundBalance(communityId, amount, false); // Assuming false means subtract

    return txHash;
  } catch (error) {
    console.error("Error transferring funds:", error);
    throw error;
  }
}

export async function getProposals(communityId: string) {
  try {
    const proposalCount = await votingMechanism.getProposalCount(communityId);
    const proposals = [];

    for (let i = 0; i < proposalCount; i++) {
      const proposal = await votingMechanism.getProposal(communityId, i);
      proposals.push({
        id: proposal.id.toString(),
        description: proposal.description,
        amount: proposal.amount.toString(),
        status: proposal.executed
          ? "executed"
          : proposal.deadline > Date.now() / 1000
          ? "active"
          : "expired",
        votes: {
          for: proposal.forVotes.toString(),
          against: proposal.againstVotes.toString(),
        },
      });
    }

    return proposals;
  } catch (error) {
    console.error("Error fetching proposals:", error);
    throw error;
  }
}

export async function isCommunityMember(
  communityId: string,
  userAddress: string
) {
  if (!communityDAO) {
    throw new Error("Contracts not initialized");
  }

  try {
    return await communityDAO.isMember(communityId, userAddress);
  } catch (error) {
    console.error("Error checking community membership:", error);
    throw error;
  }
}

export async function getCommunityCount() {
  if (!communityDAO) {
    throw new Error("Contracts not initialized");
  }

  try {
    const count = await communityDAO.getCommunityCount();
    console.log("Community count:", count.toString());
    return count;
  } catch (error) {
    console.error("Error getting community count:", error);
    throw error;
  }
}

export async function addMember(
  communityId: string,
  memberAddress: string,
  signer: ethers.Signer
) {
  if (!communityDAO) {
    throw new Error("Contracts not initialized");
  }

  try {
    const tx = await communityDAO
      .connect(signer)
      .addMember(communityId, memberAddress);
    await tx.wait();
    console.log("Member added successfully");
  } catch (error) {
    console.error("Error adding member:", error);
    throw error;
  }
}

export async function createFundingProposalOnChain(
  communityId: string,
  description: string,
  amount: ethers.BigNumber,
  votingPeriod: string
) {
  if (!fundManagement || !signer) {
    throw new Error("Contracts not initialized");
  }

  try {
    const tx = await fundManagement.createFundingProposal(
      ethers.BigNumber.from(communityId),
      description,
      amount,
      ethers.BigNumber.from(votingPeriod)
    );
    const receipt = await tx.wait();
    const proposalId = receipt.events.find(
      (e: any) => e.event === "FundingProposalCreated"
    ).args.proposalId;
    return proposalId;
  } catch (error) {
    console.error("Error creating funding proposal:", error);
    throw error;
  }
}

export async function getProposalDetails(proposalId: string) {
  if (!votingMechanism || !fundManagement) {
    throw new Error("Contracts not initialized");
  }

  try {
    const isFundingProposal = await fundManagement.proposalExists(proposalId);
    if (isFundingProposal) {
      const proposal = await fundManagement.getProposal(proposalId);
      return {
        id: proposalId,
        type: "funding",
        description: proposal.description,
        amount: proposal.amount.toString(),
        status: proposal.executed ? "executed" : "active",
        votes: {
          for: proposal.forVotes.toString(),
          against: proposal.againstVotes.toString(),
        },
      };
    } else {
      const proposal = await votingMechanism.getProposal(proposalId);
      return {
        id: proposalId,
        type: "voting",
        description: proposal.description,
        options: proposal.options,
        votes: proposal.votes.map((v: ethers.BigNumber) => v.toString()),
        status: proposal.executed ? "executed" : "active",
      };
    }
  } catch (error) {
    console.error("Error fetching proposal details:", error);
    throw error;
  }
}

export async function executeFundingProposal(proposalId: string) {
  if (!fundManagement || !signer) {
    throw new Error("Contracts not initialized");
  }

  try {
    const tx = await fundManagement.executeProposal(proposalId);
    await tx.wait();
    console.log("Funding proposal executed successfully");
  } catch (error) {
    console.error("Error executing funding proposal:", error);
    throw error;
  }
}

export async function convertUSDtoETH(
  usdAmount: number
): Promise<ethers.BigNumber> {
  // You'll need to implement or use an oracle service to get the current exchange rate
  // For this example, we'll use a mock rate of 1 USD = 0.0005 ETH
  const mockRate = 0.0005;
  const ethAmount = usdAmount * mockRate;
  return ethers.utils.parseEther(ethAmount.toFixed(18));
}

export async function contributeFundsToProposal(
  communityId: string,
  safeWalletAddress: string,
  amountUSD: number
) {
  if (!signer) {
    throw new Error("Signer not initialized");
  }

  try {
    // Convert USD to ETH
    const ethAmount = await convertUSDtoETH(amountUSD);

    // Send funds directly from the user's wallet to the Safe wallet
    const tx = await signer.sendTransaction({
      to: safeWalletAddress,
      value: ethAmount,
    });

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    console.log("Funds contributed successfully", receipt.transactionHash);
    return receipt.transactionHash;
  } catch (error) {
    console.error("Error contributing funds:", error);
    throw error;
  }
}
