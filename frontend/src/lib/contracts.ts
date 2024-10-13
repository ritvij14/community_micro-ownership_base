import { ethers } from "ethers";
import CommunityDAOABI from "../contract_abi/CommunityDAOUpgradeable.json";
import FundManagementABI from "../contract_abi/FundManagementUpgradeable.json";
import GovernanceTokenABI from "../contract_abi/GovernanceTokenUpgradeable.json";
import VotingMechanismABI from "../contract_abi/VotingMechanismUpgradeable.json";
import {
  createSafeWallet,
  transferFunds as safeTransferFunds,
} from "./safeWallet";

const GovernanceTokenAddress = "0xaF7dE49f0FC1F540307269a4C2846fd472b2f1F7";
const CommunityDAOAddress = "0xB4130c9473D87bDd73d7D5BcF1F960F8eAE35eC7";
const VotingMechanismAddress = "0xb2049388033F6dC5C6e92eD4A54c856a69C92A9A";
const FundManagementAddress = "0xb14c42317A9c90Bd6735D3B0d21403A4d2957b57";

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

  let provider;
  if (typeof privyProvider === "string") {
    provider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
    signer = new ethers.Wallet(privyProvider, provider);
  } else {
    provider = new ethers.providers.Web3Provider(privyProvider);
    signer = provider.getSigner();
  }

  // Check if we're on the correct network
  const network = await provider.getNetwork();
  if (network.chainId !== 84532) {
    // Base Sepolia chain ID
    throw new Error("Please connect to Base Sepolia network");
  }

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

export async function createCommunity(
  name: string,
  description: string,
  type: "residential" | "commercial"
) {
  if (!communityDAO) {
    throw new Error("Contracts not initialized");
  }

  try {
    const communityType = type === "residential" ? 0 : 1;
    console.log("Creating community with params:", { name, communityType });

    // Log the current signer address
    const signerAddress = await signer.getAddress();
    const balance = await checkBalance(signerAddress);
    if (balance.isZero()) {
      throw new Error("Insufficient balance to pay for gas");
    }

    // Log the contract address
    console.log("CommunityDAO contract address:", CommunityDAOAddress);

    // Set a high gas limit manually
    const highGasLimit = 1000000; // Adjust this value as needed
    console.log("Using manual gas limit:", highGasLimit);

    const tx = await communityDAO.createCommunity(name, communityType, {
      gasLimit: highGasLimit,
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
  } catch (error) {
    console.error("Detailed error in createCommunity:", error);

    if (error instanceof Error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "error" in error &&
        typeof error.error === "object" &&
        error.error !== null &&
        "data" in error.error &&
        typeof error.error.data === "string"
      ) {
        try {
          const decodedError = communityDAO.interface.parseError(
            error.error.data
          );
          console.error("Decoded error:", decodedError);
        } catch (parseError) {
          console.error("Failed to parse error:", parseError);
        }
      }

      console.error("Error message:", error.message);
      if ("code" in error) console.error("Error code:", error.code);
      if ("transaction" in error)
        console.error("Transaction details:", error.transaction);

      throw new Error(`Failed to create community: ${error.message}`);
    } else {
      throw new Error("Failed to create community: Unknown error");
    }
  }
}

export async function createProposal(
  communityId: string,
  description: string,
  amount: ethers.BigNumberish
) {
  try {
    const tx = await votingMechanism.createProposal(
      communityId,
      description,
      amount
    );
    const receipt = await tx.wait();
    const proposalId = receipt.events[0].args.proposalId;
    return proposalId;
  } catch (error) {
    console.error("Error creating proposal:", error);
    throw error;
  }
}

export async function vote(proposalId: string, support: boolean) {
  try {
    const tx = await votingMechanism.vote(proposalId, support);
    await tx.wait();
  } catch (error) {
    console.error("Error voting:", error);
    throw error;
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
