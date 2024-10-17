"use client";

import { addMember, initializeContracts } from "@/lib/contracts";
import { getCommunity } from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import { ethers } from "ethers";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Member {
  id: string;
  display_name: string;
  email: string;
}

interface Community {
  id: string;
  name: string;
  type: "residential" | "commercial";
  description: string;
  member_ids: string[];
  members: Member[];
  admin: Member;
  nft_contract_address: string;
  nft_token_id: number;
  fund_balance: number;
  safe_wallet_address: string;
}

export default function CommunityPage({ params }: { params: { id: string } }) {
  const { user, getEthereumProvider } = usePrivy();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    async function initialize() {
      if (user?.wallet) {
        const provider = getEthereumProvider();
        await initializeContracts(provider);
      }

      try {
        const communityData = await getCommunity(params.id);
        setCommunity(communityData);
        setIsAdmin(communityData.admin && communityData.admin.id === user?.id);
      } catch (error) {
        console.error("Error fetching community data:", error);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [user, getEthereumProvider, params.id]);

  async function handleAddMember() {
    if (!community || !user?.wallet) return;

    setAddingMember(true);
    try {
      const provider = await getEthereumProvider();
      const signer = new ethers.providers.Web3Provider(provider).getSigner();
      await addMember(community.id, newMemberAddress, signer);
      // Refresh community data
      const updatedCommunity = await getCommunity(params.id);
      setCommunity(updatedCommunity);
      setNewMemberAddress("");
    } catch (error) {
      console.error("Error adding member:", error);
    } finally {
      setAddingMember(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!community) {
    return <div>Community not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{community.name}</h1>
      <p className="mb-4">{community.description}</p>
      <p className="mb-2">Type: {community.type}</p>
      <p className="mb-2">Members: {community.members.length}</p>
      <p className="mb-4">Fund Balance: ${community.fund_balance}</p>

      <Link
        href={`/community/${community.id}/proposals`}
        className="btn btn-primary mb-8"
      >
        View Proposals
      </Link>

      {isAdmin && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Add New Member</h2>
          <input
            type="text"
            value={newMemberAddress}
            onChange={(e) => setNewMemberAddress(e.target.value)}
            placeholder="Enter wallet address"
            className="input input-bordered w-full max-w-xs mr-2"
          />
          <button
            onClick={handleAddMember}
            className={`btn btn-primary ${addingMember ? "loading" : ""}`}
            disabled={addingMember || !newMemberAddress}
          >
            {addingMember ? "Adding..." : "Add Member"}
          </button>
        </div>
      )}

      <h2 className="text-2xl font-semibold mt-8 mb-4">Members</h2>
      <ul>
        {community.members.map((member) => (
          <li key={member.id} className="mb-2">
            {member.display_name} ({member.email})
            {community.admin && member.id === community.admin.id && (
              <span className="ml-2 text-sm font-semibold text-blue-600">
                (Admin)
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
