import Safe, { Eip1193Provider } from "@safe-global/protocol-kit";
import { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";
import { ethers } from "ethers";
import {
  contributeFundsToProposal,
  convertUSDtoETH,
  createCommunityOnChain,
  createFundingProposalOnChain,
  createVotingProposalOnChain,
  executeProposal as executeProposalOnChain,
  isCommunityMember as isCommunityMemberContract,
  mintMembershipNFT,
  voteOnProposal as voteOnProposalOnChain,
} from "./contracts";
import { createSafeWallet } from "./safeWallet";
import { supabase } from "./supabase";

interface User {
  id: string;
  email: string;
  display_name: string;
  bio: string | null;
  wallet_address: string | null;
  communities: string[];
  created_at: string;
  updated_at: string;
}

// Add this interface definition
interface Proposal {
  id: string;
  community_id: string;
  type: "funding" | "voting";
  description: string;
  amount?: string; // This will now be in USD
  amount_received?: string; // New field for tracking received funds in USD
  status: "active" | "executed";
  votes?: {
    for: string;
    against: string;
    voters: { name: string; support: boolean; userId: string }[];
  };
}

export async function createOrUpdateUser(
  userId: string,
  email: string,
  displayName: string,
  bio?: string,
  walletAddress?: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        id: userId,
        email,
        display_name: displayName,
        bio,
        wallet_address: walletAddress,
      },
      { onConflict: "id" }
    )
    .select();

  if (error) {
    console.error("Error creating/updating user:", error);
    return null;
  }
  return data?.[0] as User;
}

export async function getUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
  return data as User;
}

export async function updateUserCommunities(
  userId: string,
  communityIds: string[]
): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .update({ communities: communityIds })
    .eq("id", userId);

  if (error) {
    console.error("Error updating user communities:", error);
    return false;
  }
  return true;
}

export async function createCommunity(
  name: string,
  description: string,
  type: "residential" | "commercial",
  creatorId: string,
  creatorWalletAddress: string
) {
  // Check if a community with the same name already exists
  const { data: existingCommunity, error: checkError } = await supabase
    .from("communities")
    .select("id")
    .eq("name", name)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    throw checkError;
  }

  if (existingCommunity) {
    throw new Error("A community with this name already exists");
  }

  try {
    // Create community on-chain
    const communityId = await createCommunityOnChain(name, description, type);

    // Create a Safe wallet for the community using the creator's wallet address
    const safeWalletAddress = await createSafeWallet([creatorWalletAddress], 1);

    // If on-chain operation is successful, update the database
    const { data, error } = await supabase
      .from("communities")
      .insert({
        id: communityId,
        name,
        description,
        type,
        member_ids: [creatorId],
        admin: creatorId,
        safe_wallet_address: safeWalletAddress,
      })
      .select();

    if (error) throw error;

    // Update user's communities array
    await updateUserCommunities(creatorId, [communityId]);

    return data[0];
  } catch (error) {
    console.error("Error creating community:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to create community: ${error.message}`);
    } else {
      throw new Error("Failed to create community: Unknown error");
    }
  }
}

export async function getCommunity(communityId: string) {
  const { data: community, error } = await supabase
    .from("communities")
    .select("*")
    .eq("id", communityId)
    .single();

  if (error) throw error;

  // Fetch all member details
  const { data: members, error: membersError } = await supabase
    .from("users")
    .select("id, display_name, email")
    .in("id", community.member_ids || []);

  if (membersError) {
    console.error("Error fetching member details:", membersError);
    throw membersError;
  }

  let admin = null;
  if (community.admin) {
    // Fetch admin details
    const { data: adminData, error: adminError } = await supabase
      .from("users")
      .select("id, display_name, email")
      .eq("id", community.admin)
      .single();

    if (adminError) {
      console.error("Error fetching admin details:", adminError);
      // Don't throw the error, just log it
    } else {
      console.log("admin", adminData);

      admin = adminData;
    }
  }

  return {
    ...community,
    members: members || [],
    admin,
  };
}

export async function joinCommunity(userId: string, communityId: string) {
  const { data: community, error: fetchError } = await supabase
    .from("communities")
    .select("member_ids")
    .eq("id", communityId)
    .single();

  if (fetchError) throw fetchError;

  // Check if the user is already a member
  if (!community.member_ids.includes(userId)) {
    const updatedMemberIds = [...community.member_ids, userId];

    const { data: user } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", userId)
      .single();

    if (!user?.wallet_address) {
      throw new Error("User wallet address not found");
    }

    // Mint NFT for the user
    const tokenId = await mintMembershipNFT(communityId);

    const { data, error } = await supabase
      .from("communities")
      .update({
        member_ids: updatedMemberIds,
        nft_token_id: tokenId,
      })
      .eq("id", communityId)
      .select();

    if (error) throw error;

    // Update user's communities array
    const userCommunities = await getUserCommunities(userId);
    await updateUserCommunities(userId, [...userCommunities, communityId]);

    return data[0];
  }

  return community;
}

export async function leaveCommunity(userId: string, communityId: string) {
  const { data, error } = await supabase.rpc("leave_community", {
    user_id: userId,
    community_id: communityId,
  });

  if (error) throw error;
  return data;
}

export async function getUserCommunities(userId: string) {
  try {
    // First, fetch all communities where the user is a member
    const { data: userCommunities, error: communitiesError } = await supabase
      .from("communities")
      .select("*")
      .contains("member_ids", [userId]);

    if (communitiesError) {
      console.error("Error fetching communities:", communitiesError);
      return [];
    }

    // Fetch admin details for each community
    const communitiesWithAdmins = await Promise.all(
      userCommunities.map(async (community) => {
        if (community.admin) {
          const { data: adminData, error: adminError } = await supabase
            .from("users")
            .select("id, display_name, email")
            .eq("id", community.admin)
            .single();

          if (adminError) {
            console.error(
              `Error fetching admin for community ${community.id}:`,
              adminError
            );
            return { ...community, admin: null };
          }

          return { ...community, admin: adminData };
        }
        return { ...community, admin: null };
      })
    );

    return communitiesWithAdmins;
  } catch (error) {
    console.error("Error in getUserCommunities:", error);
    return [];
  }
}

async function getSafeInstance(communityId: string): Promise<Safe> {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const { data: community } = await supabase
    .from("communities")
    .select("safe_address")
    .eq("id", communityId)
    .single();

  if (!community?.safe_address) {
    throw new Error("Safe address not found for this community");
  }

  const eip1193Provider: Eip1193Provider = {
    request: async ({ method, params }) => {
      return provider.send(method, params as any[]);
    },
  };

  return await Safe.init({
    provider: eip1193Provider,
    safeAddress: community.safe_address,
  });
}

async function createFundingProposal(
  communityId: string,
  description: string,
  amount: string
): Promise<string> {
  const safe = await getSafeInstance(communityId);
  const safeAddress = await safe.getAddress();

  const safeTransactionData: SafeTransactionDataPartial = {
    to: safeAddress,
    data: "0x",
    value: ethers.utils.parseEther(amount).toString(),
  };

  const safeTransaction = await safe.createTransaction({
    transactions: [safeTransactionData],
  });

  const safeTxHash = await safe.getTransactionHash(safeTransaction);

  // Store the proposal details in the database
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      community_id: communityId,
      type: "funding",
      description,
      amount,
      safe_tx_hash: safeTxHash,
      status: "active",
    })
    .select();

  if (error) throw error;
  return data[0].id;
}

async function createVotingProposal(
  communityId: string,
  description: string,
  options: string[]
): Promise<string> {
  // For voting proposals, we don't need to create a Safe transaction
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      community_id: communityId,
      type: "voting",
      description,
      options,
      status: "active",
    })
    .select();

  if (error) throw error;
  return data[0].id;
}

export async function createProposal(
  userId: string,
  communityId: string,
  type: "funding" | "voting",
  description: string,
  votingPeriod: string,
  proposalType: number,
  amount?: number // This is now in USD
): Promise<Proposal> {
  if (!userId) {
    throw new Error("User not authenticated");
  }

  // Check if the user is a member of the community
  const user = await getUserProfile(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const isMember = await isCommunityMember(communityId, user.wallet_address!);
  if (!isMember) {
    throw new Error(
      "You must be a member of the community to create a proposal"
    );
  }
  let proposalId;
  if (type === "funding") {
    // Convert USD to ETH
    const ethAmount = await convertUSDtoETH(amount ?? 0);
    proposalId = await createFundingProposalOnChain(
      communityId,
      description,
      ethAmount,
      votingPeriod
    );
  } else {
    proposalId = await createVotingProposalOnChain(
      communityId,
      description,
      votingPeriod,
      proposalType
    );
  }

  const now = new Date();
  const endTime = new Date(now.getTime() + parseInt(votingPeriod) * 1000);

  let proposalData: any = {
    id: ethers.BigNumber.isBigNumber(proposalId)
      ? proposalId.toNumber()
      : proposalId,
    community_id: communityId,
    type,
    description,
    status: "active",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    voting_end_time: endTime.toISOString(),
    votes_for: 0,
    votes_against: 0,
    amount: amount ? amount.toString() : undefined, // Store USD amount
    amount_received: "0", // Initialize amount_received to 0
  };

  const { data, error } = await supabase
    .from("proposals")
    .insert(proposalData)
    .select()
    .single();

  if (error) throw error;
  return data as Proposal;
}

export async function getProposals(communityId: string): Promise<Proposal[]> {
  try {
    const { data, error } = await supabase
      .from("proposals")
      .select(
        `
        *,
        votes (
          user_id,
          support,
          users (
            id,
            display_name,
            email
          )
        )
      `
      )
      .eq("community_id", communityId);

    if (error) throw error;

    return data.map((proposal) => ({
      ...proposal,
      status:
        new Date(proposal.voting_end_time) > new Date() ? "active" : "closed",
      votes: {
        for:
          proposal.votes?.filter((v: any) => v.support).length.toString() ||
          "0",
        against:
          proposal.votes?.filter((v: any) => !v.support).length.toString() ||
          "0",
        voters:
          proposal.votes?.map((v: any) => ({
            name: v.users?.display_name || v.users?.email || "Unknown User",
            support: v.support,
            userId: v.user_id,
          })) || [],
      },
      amount: proposal.amount, // This is now in USD
      amount_received: proposal.amount_received || "0", // Ensure this is included
    }));
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
}

export async function voteOnProposal(
  proposalId: string,
  userId: string,
  support: boolean
) {
  await voteOnProposalOnChain(proposalId, support);

  const { data: existingVote, error: existingVoteError } = await supabase
    .from("votes")
    .select()
    .eq("proposal_id", proposalId)
    .eq("user_id", userId)
    .single();

  if (existingVoteError && existingVoteError.code !== "PGRST116") {
    throw existingVoteError;
  }

  if (existingVote) {
    throw new Error("User has already voted on this proposal");
  }

  const { data, error } = await supabase
    .from("votes")
    .insert({
      proposal_id: proposalId,
      user_id: userId,
      support,
    })
    .select();

  if (error) throw error;

  // Update vote counts in the proposals table
  const updateColumn = support ? "votes_for" : "votes_against";
  await supabase.rpc("increment_vote_count", {
    p_proposal_id: proposalId,
    p_column: updateColumn,
  });

  return data[0];
}

export async function executeFundingProposal(
  proposalId: string
): Promise<boolean> {
  const success = await executeProposalOnChain(proposalId);

  if (success) {
    await supabase
      .from("proposals")
      .update({ status: "executed" })
      .eq("id", proposalId);
  }

  return success;
}

export async function isCommunityMember(
  communityId: string,
  userAddress: string
) {
  try {
    return await isCommunityMemberContract(communityId, userAddress);
  } catch (error) {
    console.error("Error checking community membership:", error);
    return false;
  }
}

export async function contributeFunds(proposalId: string, amountUSD: number) {
  try {
    // First, get the proposal and community details
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, community_id, amount_received")
      .eq("id", proposalId)
      .single();

    if (proposalError) throw proposalError;
    if (!proposal) throw new Error("Proposal not found");

    // Get the community's safe wallet address
    const { data: community, error: communityError } = await supabase
      .from("communities")
      .select("safe_wallet_address")
      .eq("id", proposal.community_id)
      .single();

    if (communityError) throw communityError;
    if (!community || !community.safe_wallet_address) {
      throw new Error("Community safe wallet address not found");
    }

    // Call the contributeFundsToProposal function
    const txHash = await contributeFundsToProposal(
      proposal.community_id,
      community.safe_wallet_address,
      amountUSD
    );

    if (txHash) {
      // Update the proposal's amount_received in the database
      const newAmountReceived = parseFloat(proposal.amount_received || "0") + amountUSD;
      const { error: updateError } = await supabase
        .from("proposals")
        .update({ amount_received: newAmountReceived.toString() })
        .eq("id", proposalId);

      if (updateError) throw updateError;

      console.log("Funds contributed and database updated successfully");
      return txHash;
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error) {
    console.error("Error contributing funds:", error);
    throw error;
  }
}

export async function getAllCommunitiesWithAdmins() {
  try {
    // Fetch all communities
    const { data: communities, error: communitiesError } = await supabase
      .from("communities")
      .select("*");

    if (communitiesError) {
      console.error("Error fetching communities:", communitiesError);
      return [];
    }

    // Fetch admin details for each community
    const communitiesWithAdmins = await Promise.all(
      communities.map(async (community) => {
        if (community.admin) {
          const { data: adminData, error: adminError } = await supabase
            .from("users")
            .select("id, display_name, email")
            .eq("id", community.admin)
            .single();

          if (adminError) {
            console.error(
              `Error fetching admin for community ${community.id}:`,
              adminError
            );
            return { ...community, admin: null };
          }

          return { ...community, admin: adminData };
        }
        return { ...community, admin: null };
      })
    );

    return communitiesWithAdmins;
  } catch (error) {
    console.error("Error in getAllCommunitiesWithAdmins:", error);
    return [];
  }
}

// Add this new function
export async function getUserByWalletAddress(
  walletAddress: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("wallet_address", walletAddress)
    .single();

  if (error) {
    console.error("Error fetching user by wallet address:", error);
    return null;
  }

  return data as User;
}

// Update the updateCommunityMembers function to accept user IDs
export async function updateCommunityMembers(
  communityId: string,
  memberIds: string[]
) {
  const { data, error } = await supabase
    .from("communities")
    .update({ member_ids: memberIds })
    .eq("id", communityId);

  if (error) {
    console.error("Error updating community members:", error);
    throw error;
  }

  return data;
}

export async function updateUserWalletAddress(
  userId: string,
  walletAddress: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("users")
      .update({ wallet_address: walletAddress })
      .eq("id", userId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error updating wallet address:", error);
    throw error;
  }
}
