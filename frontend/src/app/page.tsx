"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createOrUpdateUser } from "../lib/user";

export default function Home() {
  const { authenticated, ready, user } = usePrivy();
  const { login } = useLogin({
    onComplete: async (
      user,
      isNewUser,
      wasAlreadyAuthenticated,
      loginMethod,
      linkedAccount
    ) => {
      console.log(user);
      await createOrUpdateUser(
        user.id,
        user.google?.email || user.email?.address || "",
        user.google?.name || user.email?.address || "Anonymous",
        "",
        user.wallet?.address
      );
    },
    onError: (error) => {
      console.log(error);
      // Any logic you'd like to execute after a user exits the login flow or there is an error
    },
  });

  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleAuthentication = async () => {
      if (authenticated && user) {
        setLoading(true);
        console.log(user);

        try {
          await createOrUpdateUser(
            user.id,
            user.google?.email || user.email?.address || "",
            user.google?.name || user.email?.address || "Anonymous",
            "",
            user.wallet?.address
          );
          router.push("/dashboard");
        } catch (error) {
          console.error("Error updating user data:", error);
          setLoading(false);
        }
      }
    };

    handleAuthentication();
  }, [authenticated, user, router]);

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
    return <div className="text-black">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-3xl sm:text-4xl font-semibold mb-4 sm:mb-6">
        Welcome to <span className="font-bold">MOLC</span> <br />
        (Micro-Ownership for Local Communities)
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
