"use client";

import {
  contributeFunds,
  getProposals,
  getUserCommunities,
  getUserProfile,
  updateUserWalletAddress,
  voteOnProposal,
} from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
  display_name: string;
  email: string;
  wallet_address: string | null;
}

interface Community {
  id: string;
  name: string;
  description: string;
  type: "residential" | "commercial";
}

interface Proposal {
  id: string;
  community_id: string;
  description: string;
  type: "funding" | "voting";
  amount?: string;
  amount_received?: string;
  status: "active" | "executed";
  votes?: {
    for: string;
    against: string;
    voters: { name: string; support: boolean; userId: string }[];
  };
}

export default function Dashboard() {
  const { logout, user: privyUser } = usePrivy();
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [contributionAmounts, setContributionAmounts] = useState<{
    [key: string]: string;
  }>({});

  useEffect(() => {
    async function fetchUserData() {
      if (privyUser?.id) {
        try {
          const profile = await getUserProfile(privyUser.id);
          setUserProfile(profile);

          // Check if the user's wallet address needs to be updated
          if (!profile?.wallet_address && privyUser.wallet?.address) {
            await updateUserWalletAddress(
              privyUser.id,
              privyUser.wallet.address
            );
            // Update the local state with the new wallet address
            setUserProfile((prevProfile) => ({
              ...prevProfile!,
              wallet_address: privyUser.wallet?.address || null,
            }));
          }

          const userCommunities = await getUserCommunities(privyUser.id);
          setCommunities(userCommunities);

          // Fetch proposals for all user communities
          const allProposals = await Promise.all(
            userCommunities.map((community) => getProposals(community.id))
          );
          setProposals(allProposals.flat());
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchUserData();
  }, [privyUser]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    if (!privyUser?.id) return;
    try {
      await voteOnProposal(proposalId, privyUser.id, support);
      // Refresh proposals after voting
      const updatedProposals = await Promise.all(
        communities.map((community) => getProposals(community.id))
      );
      setProposals(updatedProposals.flat());
    } catch (error) {
      console.error("Error voting on proposal:", error);
    }
  };

  const handleContributeFunds = async (proposalId: string) => {
    if (!privyUser?.id) return;

    try {
      const amount = parseFloat(contributionAmounts[proposalId]);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid contribution amount");
      }

      await contributeFunds(proposalId, amount);
      // Refresh proposals after contribution
      const updatedProposals = await Promise.all(
        communities.map((community) => getProposals(community.id))
      );
      setProposals(updatedProposals.flat());
      setContributionAmounts({ ...contributionAmounts, [proposalId]: "" });
    } catch (error) {
      console.error("Error contributing funds:", error);
      alert(
        error instanceof Error ? error.message : "Failed to contribute funds"
      );
    }
  };

  function getUserVote(proposal: Proposal) {
    if (!privyUser || !proposal.votes) return null;
    const userVote = proposal.votes.voters.find(
      (voter) => voter.userId === privyUser.id
    );
    return userVote ? (userVote.support ? "For" : "Against") : null;
  }

  if (loading) {
    return <div className="text-black">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <nav className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl font-bold text-black">Dashboard</h1>
        <button
          onClick={handleLogout}
          className="btn  btn-sm w-full sm:w-auto text-black border-black hover:bg-gray-100"
        >
          Logout
        </button>
      </nav>
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-1/4 mb-8 lg:mb-0">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-black">
              Welcome, {userProfile?.display_name || "User"}
            </h2>
            <p className="mb-2 text-gray-700">Email: {userProfile?.email}</p>
            <h3 className="text-lg font-semibold mt-4 mb-2 text-black">
              Your Communities
            </h3>
            {communities.length > 0 ? (
              <ul className="space-y-4">
                {communities.map((community) => (
                  <li
                    key={community.id}
                    className="bg-white p-3 rounded shadow border border-gray-200"
                  >
                    <Link
                      href={`/community/${community.id}`}
                      className="text-black hover:underline break-words font-semibold"
                    >
                      {community.name}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">
                      {community.description.length > 100
                        ? `${community.description.substring(0, 100)}...`
                        : community.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Type: {community.type}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-700">
                You haven't joined any communities yet.
              </p>
            )}
          </div>
        </aside>
        <main className="w-full lg:w-3/4">
          {proposals.length > 0 && (
            <div className="mt-8 bg-white shadow rounded-lg p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-black">
                Recent Proposals
              </h2>
              <ul className="space-y-4">
                {proposals.map((proposal) => (
                  <li key={proposal.id} className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-black">
                      {proposal.description}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Type: {proposal.type}, Status: {proposal.status}
                    </p>
                    {proposal.type === "funding" && (
                      <>
                        <p className="text-sm text-gray-700 mb-2">
                          Target Amount: ${proposal.amount} USD
                        </p>
                        <p className="text-sm text-gray-700 mb-2">
                          Amount Received: ${proposal.amount_received || "0"}{" "}
                          USD
                        </p>
                        {parseFloat(proposal.amount_received || "0") <
                          parseFloat(proposal.amount || "0") && (
                          <div className="mt-4">
                            <input
                              type="number"
                              value={contributionAmounts[proposal.id] || ""}
                              onChange={(e) =>
                                setContributionAmounts({
                                  ...contributionAmounts,
                                  [proposal.id]: e.target.value,
                                })
                              }
                              placeholder="Contribution amount (USD)"
                              className="input input-bordered w-full max-w-xs mr-2 text-black"
                            />
                            <button
                              onClick={() => handleContributeFunds(proposal.id)}
                              className="btn btn-sm text-black border-black hover:bg-gray-100"
                            >
                              Contribute Funds
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {proposal.votes && proposal.type === "voting" && (
                      <div className="mb-2">
                        <p className="text-sm text-gray-700">
                          Votes For: {proposal.votes.for}, Against:{" "}
                          {proposal.votes.against}
                        </p>
                      </div>
                    )}
                    {proposal.status === "active" &&
                      proposal.type === "voting" && (
                        <div className="flex space-x-2 mb-2">
                          {getUserVote(proposal) ? (
                            <p className="text-sm text-gray-600">
                              You have voted: {getUserVote(proposal)}
                            </p>
                          ) : (
                            <>
                              <button
                                onClick={() => handleVote(proposal.id, true)}
                                className="btn btn-sm  text-black border-black hover:bg-gray-100"
                              >
                                Vote For
                              </button>
                              <button
                                onClick={() => handleVote(proposal.id, false)}
                                className="btn btn-sm  text-black border-black hover:bg-gray-100"
                              >
                                Vote Against
                              </button>
                            </>
                          )}
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="bg-white shadow rounded-lg p-6 mt-8 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-black">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/communities"
                className="btn text-black border-black hover:bg-gray-100"
              >
                Join New Community
              </Link>
              <Link
                href="/onboarding"
                className="btn text-black border-black hover:bg-gray-100"
              >
                Create New Community
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
