import {
  createCommunity as createCommunityOnChain,
  mintMembershipNFT,
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

    // Mint NFT for the community creator
    const tokenId = await mintMembershipNFT(communityId);

    // If both on-chain operations are successful, update the database
    const { data, error } = await supabase
      .from("communities")
      .insert({
        id: communityId,
        name,
        description,
        type,
        member_ids: [creatorId],
        nft_token_id: tokenId,
      })
      .select();

    if (error) throw error;

    // Update user's communities array
    await updateUserCommunities(creatorId, [communityId]);

    return data[0];
  } catch (error) {
    console.error("Error creating community or minting NFT:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to create community: ${error.message}`);
    } else {
      throw new Error("Failed to create community: Unknown error");
    }
  }
}

export async function getCommunity(communityId?: string) {
  if (communityId) {
    const { data, error } = await supabase
      .from("communities")
      .select("*")
      .eq("id", communityId)
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from("communities").select("*");

    if (error) throw error;
    return data;
  }
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
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("communities")
    .eq("id", userId)
    .single();

  if (userError) {
    console.error("Error fetching user communities:", userError);
    return [];
  }

  if (!user?.communities || user.communities.length === 0) {
    return [];
  }

  const { data: communities, error: communitiesError } = await supabase
    .from("communities")
    .select("*")
    .in("id", user.communities);

  if (communitiesError) {
    console.error("Error fetching communities:", communitiesError);
    return [];
  }

  return communities;
}
