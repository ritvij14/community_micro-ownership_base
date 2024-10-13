"use client";

import {
  createProposal,
  getProposals,
  isCommunityMember,
  vote,
} from "@/lib/contracts";
import { getCommunity } from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Proposal {
  id: string;
  description: string;
  amount: string;
  status: "active" | "executed" | "expired";
  votes: { for: string; against: string };
}

export default function ProposalsPage() {
  const { user } = usePrivy();
  const params = useParams();
  const router = useRouter();
  const communityId = params.id as string;

  const [community, setCommunity] = useState<any>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [newProposal, setNewProposal] = useState({
    description: "",
    amount: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user?.wallet?.address) {
        router.push("/");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const communityData = await getCommunity(communityId);
        setCommunity(communityData);

        const memberStatus = await isCommunityMember(
          communityId,
          user.wallet.address
        );
        setIsMember(memberStatus);

        if (memberStatus) {
          const proposalsData = await getProposals(communityId);
          setProposals(proposalsData as Proposal[]);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load community data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [communityId, user, router]);

  async function handleCreateProposal() {
    if (!user?.wallet?.address || !isMember) return;

    setLoading(true);
    setError(null);

    try {
      const amount = ethers.utils.parseEther(newProposal.amount);
      const proposalId = await createProposal(
        communityId,
        newProposal.description,
        amount
      );
      const updatedProposals = await getProposals(communityId);
      setProposals(updatedProposals as Proposal[]);
      setNewProposal({ description: "", amount: "" });
    } catch (err) {
      console.error("Error creating proposal:", err);
      setError("Failed to create proposal. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(proposalId: string, support: boolean) {
    if (!user?.wallet?.address || !isMember) return;

    setLoading(true);
    setError(null);

    try {
      await vote(proposalId, support);
      const updatedProposals = await getProposals(communityId);
      setProposals(updatedProposals as Proposal[]);
    } catch (err) {
      console.error("Error voting:", err);
      setError("Failed to cast vote. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!isMember) {
    return <div>You are not a member of this community.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        Proposals for {community?.name}
      </h1>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Create New Proposal</h2>
        <input
          type="text"
          placeholder="Proposal description"
          className="input input-bordered w-full mb-2"
          value={newProposal.description}
          onChange={(e) =>
            setNewProposal({ ...newProposal, description: e.target.value })
          }
        />
        <input
          type="number"
          placeholder="Amount (in ETH)"
          className="input input-bordered w-full mb-2"
          value={newProposal.amount}
          onChange={(e) =>
            setNewProposal({ ...newProposal, amount: e.target.value })
          }
        />
        <button
          onClick={handleCreateProposal}
          className="btn btn-primary"
          disabled={loading}
        >
          Create Proposal
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Proposals</h2>
        {proposals.map((proposal) => (
          <div key={proposal.id} className="border rounded-lg p-4 mb-4">
            <h3 className="text-xl font-semibold">{proposal.description}</h3>
            <p>Amount: {ethers.utils.formatEther(proposal.amount)} ETH</p>
            <p>Status: {proposal.status}</p>
            <p>
              Votes For: {proposal.votes.for} | Votes Against:{" "}
              {proposal.votes.against}
            </p>
            {proposal.status === "active" && (
              <div className="mt-2">
                <button
                  onClick={() => handleVote(proposal.id, true)}
                  className="btn btn-sm btn-success mr-2"
                  disabled={loading}
                >
                  Vote For
                </button>
                <button
                  onClick={() => handleVote(proposal.id, false)}
                  className="btn btn-sm btn-error"
                  disabled={loading}
                >
                  Vote Against
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
