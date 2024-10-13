"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

export default function Home() {
  const { login, authenticated } = usePrivy();
  const router = useRouter();

  const handleGetStarted = () => {
    if (authenticated) {
      router.push("/onboarding");
    } else {
      login();
    }
  };

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
          className="btn btn-primary w-full sm:w-auto"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
