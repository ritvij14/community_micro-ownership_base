"use client";

import { initializeContracts } from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { getUserCommunities, joinCommunity } from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

interface Community {
  id: string;
  name: string;
  type: "residential" | "commercial";
  description: string;
  member_ids: string[];
  nft_contract_address: string;
  nft_token_id: number;
  fund_balance: number;
  safe_wallet_address: string;
}

export default function Communities() {
  const { user, getEthereumProvider } = usePrivy();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [userCommunities, setUserCommunities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);

  useEffect(() => {
    async function initialize() {
      if (user?.wallet) {
        const provider = await getEthereumProvider();
        await initializeContracts(provider);
      }

      if (user?.id) {
        const userCommunitiesData = await getUserCommunities(user.id);
        setUserCommunities(userCommunitiesData);
      }
      const { data, error } = await supabase.from("communities").select("*");

      if (error) {
        console.error("Error fetching communities:", error);
      } else {
        setCommunities(data as Community[]);
      }
      setLoading(false);
    }

    initialize();
  }, [user, getEthereumProvider]);

  async function handleJoinCommunity(communityId: string) {
    if (!user?.id) return;

    setJoinLoading(communityId);
    try {
      await joinCommunity(user.id, communityId);
      setUserCommunities([...userCommunities, communityId]);
    } catch (error) {
      console.error("Error joining community:", error);
    } finally {
      setJoinLoading(null);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Available Communities</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {communities.map((community) => (
          <div key={community.id} className="border rounded-lg p-4 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">{community.name}</h2>
            <p className="text-gray-600 mb-2">{community.type}</p>
            <p className="mb-4">{community.description}</p>
            <p className="mb-2">Members: {community.member_ids.length}</p>
            <p className="mb-4">Fund Balance: ${community.fund_balance}</p>
            {!userCommunities.includes(community.id) ? (
              <button
                onClick={() => handleJoinCommunity(community.id)}
                className={`btn btn-primary ${
                  joinLoading === community.id ? "loading" : ""
                }`}
                disabled={joinLoading !== null}
              >
                {joinLoading === community.id ? "Joining..." : "Join Community"}
              </button>
            ) : (
              <span className="text-green-600">You're a member</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
