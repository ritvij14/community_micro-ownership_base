"use client";

import { getUserCommunities, getUserProfile } from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
  display_name: string;
  email: string;
  wallet_address: string | null;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { logout, user: privyUser } = usePrivy();
  const router = useRouter();
  const [communities, setCommunities] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<User | null>(null);

  console.log(privyUser);

  useEffect(() => {
    async function fetchUserData() {
      if (privyUser?.id) {
        const profile = await getUserProfile(privyUser.id);
        setUserProfile(profile);
        const userCommunities = await getUserCommunities(privyUser.id);
        setCommunities(userCommunities);
      }
    }
    fetchUserData();
  }, [privyUser]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <nav className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={handleLogout}
          className="btn btn-outline btn-sm w-full sm:w-auto"
        >
          Logout
        </button>
      </nav>
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-1/4">
          <div className="bg-gray-100 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">
              Welcome, {userProfile?.display_name || "User"}
            </h2>
            <p>Email: {userProfile?.email}</p>
            <p>Wallet: {userProfile?.wallet_address || "Not connected"}</p>
            <h3 className="text-lg font-semibold mt-4 mb-2">
              Your Communities
            </h3>
            <ul className="space-y-2">
              {communities.map((community) => (
                <li key={community.id}>
                  <Link
                    href={`/community/${community.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {community.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <main className="w-full lg:w-3/4">
          {/* ... rest of the main content ... */}
        </main>
      </div>
    </div>
  );
}
