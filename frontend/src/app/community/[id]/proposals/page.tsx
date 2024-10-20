"use client";

import {
  contributeFunds,
  createProposal,
  executeFundingProposal,
  getProposals,
  isCommunityMember,
  voteOnProposal,
} from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Proposal {
  id: string;
  type: "funding" | "voting";
  description: string;
  amount?: string; // This is now in USD
  amount_received?: string; // New field for tracking received funds in USD
  status: "active" | "executed";
  votes?: {
    for: string;
    against: string;
    voters: { name: string; support: boolean; userId: string }[];
  };
}

export default function CommunityProposals({
  params,
}: {
  params: { id: string };
}) {
  const { user } = usePrivy();
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProposal, setNewProposal] = useState({
    type: "funding",
    description: "",
    amount: "",
  });
  const [isMember, setIsMember] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("");

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

  function getUserVote(proposal: Proposal) {
    if (!user || !proposal.votes) return null;
    const userVote = proposal.votes.voters.find(
      (voter) => voter.userId === user.id
    );
    return userVote ? (userVote.support ? "For" : "Against") : null;
  }

  async function handleCreateProposal() {
    if (!user || !isMember) return;

    try {
      if (newProposal.type === "funding") {
        const amount = parseFloat(newProposal.amount);
        const MAX_AMOUNT = 1000000; // Set this to whatever maximum amount makes sense for your application
        if (isNaN(amount) || amount <= 0 || amount > MAX_AMOUNT) {
          throw new Error(
            `Invalid amount for funding proposal. Please enter a positive number not exceeding $${MAX_AMOUNT}.`
          );
        }
      }

      console.log("Attempting to create proposal:", newProposal);

      const votingPeriod = (7 * 24 * 60 * 60).toString(); // 7 days in seconds
      const amountBN = parseFloat(newProposal.amount);

      // Ensure params.id is a valid string
      if (!params.id || typeof params.id !== "string") {
        throw new Error("Invalid community ID");
      }

      const createdProposal = await createProposal(
        user.id,
        params.id,
        newProposal.type as "funding" | "voting",
        newProposal.description,
        votingPeriod,
        newProposal.type === "funding" ? 0 : 1, // 0 for funding, 1 for voting
        newProposal.type === "funding" ? amountBN : undefined
      );

      console.log("Proposal created successfully:", createdProposal);

      setProposals([...proposals, createdProposal]);
      setNewProposal({
        type: "funding",
        description: "",
        amount: "",
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

  async function handleContributeFunds(proposalId: string) {
    if (!user || !isMember) return;

    try {
      const amount = parseFloat(contributionAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid contribution amount");
      }

      await contributeFunds(proposalId, amount);
      // Refresh proposals and community fund balance after contribution
      const fetchedProposals = await getProposals(params.id);
      setProposals(fetchedProposals);
      setContributionAmount("");
    } catch (error) {
      console.error("Error contributing funds:", error);
      alert(
        error instanceof Error ? error.message : "Failed to contribute funds"
      );
    }
  }

  if (loading) {
    return <div className="text-black">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-white text-black">
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.back()}
          className="mr-4 p-2 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Go back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold">Community Proposals</h1>
      </div>

      {isMember && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn text-black border-black hover:bg-gray-100 mb-6"
        >
          Create New Proposal
        </button>
      )}

      {showCreateForm && isMember && (
        <div className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
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
            <p className="text-sm text-gray-600 mb-2">
              Note: Voting proposals have a simple "For" or "Against" format.
            </p>
          )}
          <button
            onClick={handleCreateProposal}
            className="btn  text-black border-black hover:bg-gray-100 mr-2"
          >
            Create Proposal
          </button>
          <button
            onClick={() => setShowCreateForm(false)}
            className="btn  text-black border-black hover:bg-gray-100"
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
          </div>
        ) : (
          proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="mb-4 p-4 border border-gray-200 rounded bg-gray-50"
            >
              <h3 className="text-xl font-semibold">{proposal.description}</h3>
              <p>Type: {proposal.type}</p>
              {proposal.type === "funding" && (
                <>
                  <p>Target Amount: ${proposal.amount} USD</p>
                  <p>Amount Received: ${proposal.amount_received || "0"} USD</p>
                  {parseFloat(proposal.amount_received || "0") <
                    parseFloat(proposal.amount || "0") &&
                    proposal.type === "funding" &&
                    proposal.status === "active" &&
                    isMember && (
                      <div className="mt-4">
                        <input
                          type="number"
                          value={contributionAmount}
                          onChange={(e) =>
                            setContributionAmount(e.target.value)
                          }
                          placeholder="Contribution amount (USD)"
                          className="input input-bordered w-full max-w-xs mr-2"
                        />
                        <button
                          onClick={() => handleContributeFunds(proposal.id)}
                          className="btn btn-sm  text-black border-black hover:bg-gray-100"
                        >
                          Contribute Funds
                        </button>
                      </div>
                    )}
                </>
              )}
              {isMember && proposal.status === "active" && (
                <div>
                  {proposal.type === "voting" ? (
                    <>
                      {getUserVote(proposal) ? (
                        <p className="text-sm text-gray-600 mt-2">
                          You have voted: {getUserVote(proposal)}
                        </p>
                      ) : (
                        <>
                          <button
                            onClick={() => handleVote(proposal.id, true)}
                            className="btn btn-sm  text-black border-black hover:bg-gray-100 mr-2"
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
                    </>
                  ) : (
                    <p className="text-sm text-gray-600 mt-2">
                      This is a funding proposal. Voting is not applicable.
                    </p>
                  )}
                </div>
              )}
              {proposal.votes && proposal.type === "voting" && (
                <div>
                  <p>
                    Total Votes:{" "}
                    {parseInt(proposal.votes.for) -
                      parseInt(proposal.votes.against)}
                  </p>
                  <div>
                    <p>Votes For: {proposal.votes.for}</p>
                    <ul className="list-disc list-inside ml-4">
                      {proposal.votes.voters
                        .filter((voter) => voter.support)
                        .map((voter, index) => (
                          <li key={index}>{voter.name}</li>
                        ))}
                    </ul>
                  </div>
                  <div>
                    <p>Votes Against: {proposal.votes.against}</p>
                    <ul className="list-disc list-inside ml-4">
                      {proposal.votes.voters
                        .filter((voter) => !voter.support)
                        .map((voter, index) => (
                          <li key={index}>{voter.name}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
