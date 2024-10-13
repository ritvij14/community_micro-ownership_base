"use client";

import { initializeContracts } from "@/lib/contracts";
import {
  createCommunity,
  createOrUpdateUser,
  getCommunity,
  updateUserCommunities,
} from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "react-feather"; // Make sure to install react-feather or use any other icon library

export default function Onboarding() {
  const [choice, setChoice] = useState<"create" | "join" | null>(null);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [availableCommunities, setAvailableCommunities] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [newCommunity, setNewCommunity] = useState({
    name: "",
    description: "",
    type: "residential",
  });
  const router = useRouter();
  const { user, ready, authenticated, getAccessToken, getEthereumProvider } =
    usePrivy();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initContracts() {
      if (authenticated && user?.wallet) {
        const provider = getEthereumProvider();
        await initializeContracts(provider);
      }
    }
    initContracts();
  }, [authenticated, user]);

  useEffect(() => {
    async function fetchCommunities() {
      const communities = await getCommunity();
      setAvailableCommunities(communities || []);
    }
    fetchCommunities();
  }, []);

  const handleFinish = async () => {
    if (user?.id && authenticated) {
      try {
        setError(null);
        const token = await getAccessToken();
        const walletAddress = user?.wallet?.address;

        await createOrUpdateUser(
          user.id,
          user.email?.address || user?.google?.email || "",
          displayName || user?.google?.name || "",
          bio,
          walletAddress
        );

        if (choice === "create") {
          console.log("Creating community:", newCommunity);
          const newCommunityData = await createCommunity(
            newCommunity.name,
            newCommunity.description,
            newCommunity.type as "residential" | "commercial",
            user.id
          );
          console.log("Community created:", newCommunityData);
        } else if (choice === "join" && selectedCommunities.length > 0) {
          await updateUserCommunities(user.id, selectedCommunities);
        }

        router.push("/dashboard");
      } catch (error) {
        console.error("Detailed error in handleFinish:", error);
        setError(
          error instanceof Error ? error.message : JSON.stringify(error)
        );
      }
    }
  };

  const handleCommunityToggle = (communityId: string) => {
    setSelectedCommunities((prev) =>
      prev.includes(communityId)
        ? prev.filter((id) => id !== communityId)
        : [...prev, communityId]
    );
  };

  const renderForm = () => {
    if (
      choice === "create" ||
      (choice === "join" && availableCommunities.length === 0)
    ) {
      return (
        <>
          <h3 className="text-xl font-semibold">Create Your Community</h3>
          {choice === "join" && (
            <p className="mb-4">
              There are no existing communities. Be the first to create one!
            </p>
          )}
          {error && <p className="text-red-500 mb-2">{error}</p>}
          <input
            type="text"
            placeholder="Community Name"
            className="input input-bordered w-full mb-2"
            value={newCommunity.name}
            onChange={(e) =>
              setNewCommunity({ ...newCommunity, name: e.target.value })
            }
          />
          <textarea
            placeholder="Community Description"
            className="textarea textarea-bordered w-full mb-2"
            value={newCommunity.description}
            onChange={(e) =>
              setNewCommunity({
                ...newCommunity,
                description: e.target.value,
              })
            }
          />
          <select
            className="select select-bordered w-full mb-2"
            value={newCommunity.type}
            onChange={(e) =>
              setNewCommunity({ ...newCommunity, type: e.target.value })
            }
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
          <button onClick={handleFinish} className="btn btn-primary w-full">
            Create Community and Finish
          </button>
        </>
      );
    } else if (choice === "join") {
      return (
        <>
          <h3 className="text-xl font-semibold">Choose Your Communities</h3>
          <div className="space-y-2">
            {availableCommunities.map((community) => (
              <label key={community.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  onChange={() => handleCommunityToggle(community.id)}
                  checked={selectedCommunities.includes(community.id)}
                />
                <span>{community.name}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleFinish}
            className="btn btn-primary w-full mt-4"
            disabled={selectedCommunities.length === 0}
          >
            Join Communities and Finish
          </button>
        </>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 relative">
        {choice && (
          <button
            onClick={() => setChoice(null)}
            className="absolute -top-12 left-0 btn btn-ghost p-0"
            aria-label="Go back"
          >
            <ArrowLeft size={24} />
          </button>
        )}
        <h2 className="text-3xl font-bold text-center">
          Welcome, {user?.email?.address || "User"}
        </h2>
        <div className="space-y-4">
          {!choice ? (
            <>
              <h3 className="text-xl font-semibold">Choose Your Path</h3>
              <button
                onClick={() => setChoice("create")}
                className="btn btn-primary w-full"
              >
                Create a New Community
              </button>
              <button
                onClick={() => setChoice("join")}
                className="btn btn-primary w-full"
              >
                Join Existing Communities
              </button>
            </>
          ) : (
            renderForm()
          )}
        </div>
      </div>
    </div>
  );
}
