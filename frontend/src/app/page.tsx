"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { login, authenticated, ready } = usePrivy();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authenticated) {
      router.push("/dashboard");
    }
  }, [authenticated, router]);

  const handleGetStarted = async () => {
    if (authenticated) {
      router.push("/dashboard");
    } else {
      setLoading(true);
      try {
        await login();
        // The useEffect hook will handle redirection after successful login
      } catch (error) {
        console.error("Authentication failed:", error);
        setLoading(false);
      }
    }
  };

  if (!ready) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6">
        Welcome to Fractional Ownership
      </h1>
      <p className="text-lg sm:text-xl mb-6 sm:mb-8 max-w-xs sm:max-w-2xl">
        Join local communities, participate in fractional ownership, and govern
        together.
      </p>
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <button
          onClick={handleGetStarted}
          className={`btn btn-primary w-full sm:w-auto ${
            loading ? "loading" : ""
          }`}
          disabled={loading}
        >
          {loading ? "Connecting..." : "Enter app"}
        </button>
      </div>
    </div>
  );
}
