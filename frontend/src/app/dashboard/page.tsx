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

interface Community {
  id: string;
  name: string;
  description: string;
  type: "residential" | "commercial";
}

export default function Dashboard() {
  const { logout, user: privyUser } = usePrivy();
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserData() {
      if (privyUser?.id) {
        try {
          const profile = await getUserProfile(privyUser.id);
          setUserProfile(profile);
          const userCommunities = await getUserCommunities(privyUser.id);
          setCommunities(userCommunities);
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

  if (loading) {
    return <div>Loading...</div>;
  }

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
        <aside className="w-full lg:w-1/4 mb-8 lg:mb-0">
          <div className="bg-gray-100 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">
              Welcome, {userProfile?.display_name || "User"}
            </h2>
            <p className="mb-2">Email: {userProfile?.email}</p>
            <h3 className="text-lg font-semibold mt-4 mb-2">
              Your Communities
            </h3>
            {communities.length > 0 ? (
              <ul className="space-y-4">
                {communities.map((community) => (
                  <li
                    key={community.id}
                    className="bg-white p-3 rounded shadow"
                  >
                    <Link
                      href={`/community/${community.id}`}
                      className="text-blue-600 hover:underline break-words font-semibold"
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
              <p>You haven't joined any communities yet.</p>
            )}
          </div>
        </aside>
        <main className="w-full lg:w-3/4">
          {communities.length > 0 && (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
              <p>No recent activity to display.</p>
            </div>
          )}
          <div className="bg-white shadow rounded-lg p-6 mt-8">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/communities" className="btn btn-primary">
                Join New Community
              </Link>
              <Link href="/onboarding" className="btn btn-secondary">
                Create New Community
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
