"use client";

import {
  createProposal,
  executeFundingProposal,
  getProposals,
  isCommunityMember,
  voteOnProposal,
} from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { useEffect, useState } from "react";

interface Proposal {
  id: string;
  type: "funding" | "voting";
  description: string;
  amount?: string;
  options?: string[];
  status: "active" | "executed";
  votes?: {
    for: string;
    against: string;
  };
}

export default function CommunityProposals({
  params,
}: {
  params: { id: string };
}) {
  const { user } = usePrivy();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProposal, setNewProposal] = useState({
    type: "funding",
    description: "",
    amount: "",
    options: ["", ""],
  });
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    async function initialize() {
      if (user?.wallet?.address) {
        const memberStatus = await isCommunityMember(
          params.id,
          user.wallet.address
        );
        setIsMember(memberStatus);
      }
      const fetchedProposals = await getProposals(params.id);
      setProposals(fetchedProposals);
      setLoading(false);
    }
    initialize();
  }, [params.id, user]);

  async function handleCreateProposal() {
    if (!user || !isMember) return;

    try {
      if (newProposal.type === "funding") {
        const amount = parseFloat(newProposal.amount);
        const MAX_AMOUNT = 1000000; // Set this to whatever maximum amount makes sense for your application
        if (isNaN(amount) || amount <= 0 || amount > MAX_AMOUNT) {
          throw new Error(
            `Invalid amount for funding proposal. Please enter a positive number not exceeding ${MAX_AMOUNT}.`
          );
        }
      }

      if (
        newProposal.type === "voting" &&
        newProposal.options.filter((o) => o !== "").length < 2
      ) {
        throw new Error("Voting proposal must have at least two options");
      }

      const createdProposal = await createProposal(
        params.id,
        newProposal.type as "funding" | "voting",
        newProposal.description,
        newProposal.type === "funding" ? newProposal.amount : undefined,
        newProposal.type === "voting"
          ? newProposal.options.filter((o) => o !== "")
          : undefined
      );

      setProposals([...proposals, createdProposal]);
      setNewProposal({
        type: "funding",
        description: "",
        amount: "",
        options: ["", ""],
      });
      setShowCreateForm(false);
    } catch (error) {
      console.error("Error creating proposal:", error);
      // Show error message to the user
      alert(
        error instanceof Error ? error.message : "Failed to create proposal"
      );
    }
  }

  async function handleVote(proposalId: string, support: boolean) {
    if (!user || !isMember) return;

    await voteOnProposal(proposalId, user.id, support);
    const fetchedProposals = await getProposals(params.id);
    setProposals(fetchedProposals);
  }

  async function handleExecuteFundingProposal(proposalId: string) {
    if (!user || !isMember) return;

    try {
      const success = await executeFundingProposal(proposalId);
      if (success) {
        const fetchedProposals = await getProposals(params.id);
        setProposals(fetchedProposals);
      } else {
        console.error("Error executing funding proposal");
      }
    } catch (error) {
      console.error("Error executing funding proposal:", error);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Community Proposals</h1>

      {showCreateForm && isMember && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Create New Proposal</h2>
          <select
            value={newProposal.type}
            onChange={(e) =>
              setNewProposal({
                ...newProposal,
                type: e.target.value as "funding" | "voting",
              })
            }
            className="select select-bordered w-full max-w-xs mb-2"
          >
            <option value="funding">Funding Proposal</option>
            <option value="voting">Voting Proposal</option>
          </select>
          <input
            type="text"
            value={newProposal.description}
            onChange={(e) =>
              setNewProposal({ ...newProposal, description: e.target.value })
            }
            placeholder="Proposal description"
            className="input input-bordered w-full mb-2"
          />
          {newProposal.type === "funding" && (
            <input
              type="number"
              value={newProposal.amount}
              onChange={(e) =>
                setNewProposal({ ...newProposal, amount: e.target.value })
              }
              placeholder="Funding amount"
              className="input input-bordered w-full mb-2"
            />
          )}
          {newProposal.type === "voting" && (
            <div>
              {newProposal.options.map((option, index) => (
                <input
                  key={index}
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...newProposal.options];
                    newOptions[index] = e.target.value;
                    setNewProposal({ ...newProposal, options: newOptions });
                  }}
                  placeholder={`Option ${index + 1}`}
                  className="input input-bordered w-full mb-2"
                />
              ))}
              <button
                onClick={() =>
                  setNewProposal({
                    ...newProposal,
                    options: [...newProposal.options, ""],
                  })
                }
                className="btn btn-secondary mb-2"
              >
                Add Option
              </button>
            </div>
          )}
          <button
            onClick={handleCreateProposal}
            className="btn btn-primary mr-2"
          >
            Create Proposal
          </button>
          <button
            onClick={() => setShowCreateForm(false)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-semibold mb-4">Active Proposals</h2>
        {proposals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xl mb-4">No active proposals at the moment.</p>
            {isMember && !showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn btn-primary"
              >
                Create New Proposal
              </button>
            )}
          </div>
        ) : (
          proposals.map((proposal) => (
            <div key={proposal.id} className="mb-4 p-4 border rounded">
              <h3 className="text-xl font-semibold">{proposal.description}</h3>
              <p>Type: {proposal.type}</p>
              {proposal.type === "funding" && (
                <p>
                  Amount: ${ethers.utils.formatEther(proposal.amount || "0")}{" "}
                  ETH
                </p>
              )}
              {proposal.type === "voting" && (
                <div>
                  <p>Options:</p>
                  <ul>
                    {proposal.options?.map((option, index) => (
                      <li key={index}>{option}</li>
                    ))}
                  </ul>
                </div>
              )}
              {isMember && proposal.status === "active" && (
                <div>
                  <button
                    onClick={() => handleVote(proposal.id, true)}
                    className="btn btn-sm mr-2"
                  >
                    Vote For
                  </button>
                  <button
                    onClick={() => handleVote(proposal.id, false)}
                    className="btn btn-sm"
                  >
                    Vote Against
                  </button>
                </div>
              )}
              {proposal.votes && (
                <div>
                  <p>Votes For: {proposal.votes.for}</p>
                  <p>Votes Against: {proposal.votes.against}</p>
                </div>
              )}
              {proposal.type === "funding" &&
                proposal.status === "active" &&
                isMember && (
                  <button
                    onClick={() => handleExecuteFundingProposal(proposal.id)}
                    className="btn btn-sm mt-2"
                  >
                    Execute Funding
                  </button>
                )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
