import Safe, { Eip1193Provider } from "@safe-global/protocol-kit";
import { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";
import { ethers } from "ethers";
import {
  createCommunityOnChain,
  createProposal as createProposalOnChain,
  executeProposal as executeProposalOnChain,
  isCommunityMember as isCommunityMemberContract,
  mintMembershipNFT,
  voteOnProposal as voteOnProposalOnChain,
} from "./contracts";
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
  amount?: string;
  options?: string[];
  safe_tx_hash?: string;
  status: "active" | "executed";
  created_at: string;
  updated_at: string;
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
  creatorId: string
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

    // If on-chain operation is successful, update the database
    const { data, error } = await supabase
      .from("communities")
      .insert({
        id: communityId,
        name,
        description,
        type,
        member_ids: [creatorId],
        admin_id: creatorId,
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
  console.log("community", community);
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
    // First, fetch all communities
    const { data: allCommunities, error: communitiesError } = await supabase
      .from("communities")
      .select("*");

    if (communitiesError) {
      console.error("Error fetching communities:", communitiesError);
      return [];
    }

    // Filter communities where the user is a member
    const userCommunities = allCommunities.filter(
      (community) =>
        community.member_ids && community.member_ids.includes(userId)
    );

    return userCommunities;
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
  communityId: string,
  type: "funding" | "voting",
  description: string,
  amount?: string,
  options?: string[]
): Promise<Proposal> {
  const votingPeriod = 7 * 24 * 60 * 60; // 7 days in seconds
  const amountBN = amount
    ? ethers.utils.parseEther(amount)
    : ethers.constants.Zero;

  const proposalId = await createProposalOnChain(
    communityId,
    description,
    amountBN,
    type === "voting" ? options : undefined
  );

  const now = new Date();
  const endTime = new Date(now.getTime() + votingPeriod * 1000);

  let proposalData: any = {
    id: proposalId,
    community_id: communityId,
    type,
    description,
    status: "active",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    voting_end_time: endTime.toISOString(),
    votes_for: 0,
    votes_against: 0,
  };

  if (type === "funding") {
    proposalData.amount = amountBN.toString();
  } else {
    proposalData.options = options;
  }

  const { data, error } = await supabase
    .from("proposals")
    .insert(proposalData)
    .select()
    .single();

  if (error) throw error;
  return data as Proposal;
}

export async function getProposals(communityId: string): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("community_id", communityId);

  if (error) throw error;

  return data.map((proposal) => ({
    ...proposal,
    status:
      new Date(proposal.voting_end_time) > new Date() ? "active" : "closed",
    votes: {
      for: proposal.votes_for,
      against: proposal.votes_against,
    },
  }));
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
