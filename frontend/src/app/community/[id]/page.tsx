"use client";

import { addMember, initializeContracts } from "@/lib/contracts";
import { getSafeWalletBalance, initializeSafeSDK } from "@/lib/safeWallet";
import {
  getCommunity,
  getUserByWalletAddress,
  updateCommunityMembers,
} from "@/lib/user";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const {wallets} = useWallets();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [safeWalletBalance, setSafeWalletBalance] = useState<string>("0.00");
  const router = useRouter();

  useEffect(() => {
    async function initialize() {
      if (user?.wallet) {
        const provider = getEthereumProvider();
        await initializeContracts(provider);
        await initializeSafeSDK(provider); // Initialize Safe SDK
      }

      try {
        const communityData = await getCommunity(params.id);
        setCommunity(communityData);
        setIsAdmin(communityData.admin && communityData.admin.id === user?.id);

        // Fetch Safe wallet balance
        if (communityData.safe_wallet_address) {
          const provider = await wallets[0].getEthereumProvider();
          const balance = await getSafeWalletBalance(
            communityData.safe_wallet_address,
            provider
          );
          setSafeWalletBalance(balance);
        }
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

      // Get the user by wallet address
      const newUser = await getUserByWalletAddress(newMemberAddress);
      if (!newUser) {
        throw new Error("User not found for the given wallet address");
      }

      // Add member on-chain
      await addMember(community.id, newMemberAddress, signer);

      // Update the database
      const updatedMemberIds = [...community.member_ids, newUser.id];
      await updateCommunityMembers(community.id, updatedMemberIds);

      // Refresh community data
      const updatedCommunity = await getCommunity(params.id);
      setCommunity(updatedCommunity);
      setNewMemberAddress("");

      // Show success message
      alert("Member added successfully!");
    } catch (error) {
      console.error("Error adding member:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to add member. Please try again."
      );
    } finally {
      setAddingMember(false);
    }
  }

  if (loading) {
    return <div className="text-black">Loading...</div>;
  }

  if (!community) {
    return <div>Community not found</div>;
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
        <h1 className="text-3xl font-bold">{community.name}</h1>
      </div>
      <p className="mb-4">{community.description}</p>
      <p className="mb-2">Type: {community.type}</p>
      <p className="mb-2">Members: {community.members.length}</p>
      <p className="mb-4">Safe Wallet Balance: ${safeWalletBalance} USD</p>

      <Link
        href={`/community/${community.id}/proposals`}
        className="btn text-black border-black hover:bg-gray-100 mb-8"
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
            className="input input-bordered w-full max-w-xs mr-2 text-black"
          />
          <button
            onClick={handleAddMember}
            className={`btn text-black border-black hover:bg-gray-100 ${
              addingMember ? "loading" : ""
            }`}
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
