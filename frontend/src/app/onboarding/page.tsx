"use client";

import { initializeContracts } from "@/lib/contracts";
import { initializeSafeSDK } from "@/lib/safeWallet";
import {
  createCommunity,
  createOrUpdateUser,
  getUserCommunities,
  updateUserCommunities,
} from "@/lib/user";
import { usePrivy, useWallets } from "@privy-io/react-auth";
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
  const { user, ready, authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function initSDKs() {
      if (authenticated && wallets.length > 0) {
        try {
          const provider = await wallets[0].getEthereumProvider();
          if (!provider) {
            throw new Error("Failed to get Ethereum provider");
          }
          await initializeContracts(provider);
          await initializeSafeSDK(provider);
          console.log("Contracts and Safe SDK initialized successfully");
        } catch (error) {
          console.error("Failed to initialize SDKs:", error);
          setError(
            "Failed to initialize. Please ensure you're connected to Base Sepolia network and try again."
          );
        }
      }
    }
    initSDKs();
  }, [authenticated, wallets]);

  useEffect(() => {
    async function fetchCommunities() {
      try {
        const communities = await getUserCommunities(user?.id || "");
        setAvailableCommunities(communities || []);
      } catch (error) {
        console.error("Error fetching communities:", error);
        setError("Failed to fetch communities. Please try again.");
      }
    }
    if (user?.id) {
      fetchCommunities();
    }
  }, [user?.id]);

  const handleFinish = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      if (user?.id && authenticated && wallets.length > 0) {
        setError(null);
        const token = await getAccessToken();
        const walletAddress = wallets[0].address;

        await createOrUpdateUser(
          user.id,
          user.email?.address || user?.google?.email || "",
          displayName || user?.google?.name || "",
          bio,
          walletAddress
        );

        if (choice === "create") {
          console.log("Creating community:", newCommunity);
          const provider = await wallets[0].getEthereumProvider();
          if (!provider) {
            throw new Error("Failed to get Ethereum provider");
          }
          await initializeContracts(provider);
          await initializeSafeSDK(provider);
          const newCommunityData = await createCommunity(
            newCommunity.name,
            newCommunity.description,
            newCommunity.type as "residential" | "commercial",
            user.id,
            walletAddress // Pass the wallet address here
          );
          console.log("Community created:", newCommunityData);
        } else if (choice === "join" && selectedCommunities.length > 0) {
          await updateUserCommunities(user.id, selectedCommunities);
        }

        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error in handleFinish:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsCreating(false);
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
          <button
            onClick={handleFinish}
            className={`btn btn-primary ${
              isCreating ? "loading loading-md" : "w-full"
            }`}
            disabled={isCreating}
          >
            {isCreating
              ? "Creating Community..."
              : "Create Community and Finish"}
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
        {/* {error && (
          <div className="text-red-500 mb-4">
            {error}
            <button
              onClick={retryInitialization}
              className="btn btn-primary mt-2 w-full"
            >
              Retry Connection
            </button>
          </div>
        )} */}
      </div>
    </div>
  );
}
