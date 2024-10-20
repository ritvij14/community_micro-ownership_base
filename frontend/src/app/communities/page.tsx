"use client";

import { getAllCommunitiesWithAdmins, getUserCommunities } from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Proposal {
  id: string;
  type: "funding" | "voting";
  description: string;
  amount?: string;
  status: "active" | "executed";
  votes?: {
    for: string;
    against: string;
    voters: { name: string; support: boolean; userId: string }[];
  };
}

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
  admin: {
    id: string;
    display_name: string;
    email: string;
  } | null;
  proposals: Proposal[];
}

export default function Communities() {
  const { user, getEthereumProvider } = usePrivy();
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [userCommunities, setUserCommunities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(
    null
  );

  useEffect(() => {
    async function initialize() {
      if (user?.wallet) {
        const provider = await getEthereumProvider();
        const signer = new ethers.providers.Web3Provider(provider).getSigner();
        const address = await signer.getAddress();
        setUserWalletAddress(address);
      }

      if (user?.id) {
        const userCommunitiesData = await getUserCommunities(user.id);
        setUserCommunities(userCommunitiesData.map((c) => c.id));
      }

      const allCommunitiesData = await getAllCommunitiesWithAdmins();
      setCommunities(allCommunitiesData as Community[]);

      setLoading(false);
    }

    initialize();
  }, [user, getEthereumProvider]);

  function getUserVote(proposal: Proposal) {
    if (!user || !proposal.votes) return null;
    const userVote = proposal.votes.voters.find(
      (voter) => voter.userId === user?.id
    );
    return userVote ? (userVote.support ? "For" : "Against") : null;
  }

  const handleBackToDashboard = () => {
    router.push("/dashboard");
  };

  if (loading) {
    return <div className="text-black">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-white text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Available Communities</h1>
        <button
          onClick={handleBackToDashboard}
          className="btn btn-outline btn-sm"
        >
          Back to Dashboard
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6">
        {communities.map((community) => (
          <div
            key={community.id}
            className="border border-gray-200 rounded-lg p-4 shadow-sm bg-gray-50"
          >
            <h2 className="text-xl font-semibold mb-2">{community.name}</h2>
            <p className="text-gray-600 mb-2">{community.type}</p>
            <p className="mb-4">{community.description}</p>
            <p className="mb-2">Members: {community.member_ids.length}</p>
            <p className="mb-4">Fund Balance: ${community.fund_balance}</p>
            {!userCommunities.includes(community.id) && (
              <div>
                <p className="mb-2">
                  To join, contact admin at: {community.admin?.email || "N/A"}
                </p>
                <p className="mb-2 text-wrap flex-wrap">
                  Your wallet address: {userWalletAddress || "Not available"}
                </p>
              </div>
            )}
            {userCommunities.includes(community.id) && (
              <span className="text-green-600">You're a member</span>
            )}

            {userCommunities.includes(community.id) && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Active Proposals</h3>
                {community.proposals && community.proposals.length > 0 ? (
                  community.proposals.map((proposal) => (
                    <div
                      key={proposal.id}
                      className="mb-2 p-2 bg-white rounded"
                    >
                      <p className="font-semibold">{proposal.description}</p>
                      <p className="text-sm">Type: {proposal.type}</p>
                      {proposal.type === "voting" && (
                        <div className="mt-1">
                          {getUserVote(proposal) ? (
                            <p className="text-sm text-gray-600">
                              You have voted: {getUserVote(proposal)}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-600">
                              You haven't voted on this proposal yet.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">No active proposals</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
