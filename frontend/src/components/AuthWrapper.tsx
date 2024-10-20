"use client";

import { initializeContracts } from "@/lib/contracts";
import { usePrivy } from "@privy-io/react-auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, getEthereumProvider, ready, authenticated } = usePrivy();
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function initialize() {
      if (ready && authenticated && user?.wallet && pathname !== "/") {
        try {
          const provider = await getEthereumProvider();
          await initializeContracts(provider);
          setIsInitialized(true);
        } catch (error) {
          console.error("Error initializing contracts:", error);
        }
      } else if (ready && !authenticated && pathname !== "/") {
        // Redirect to home page if not authenticated
        router.push("/");
      } else if (pathname === "/") {
        // Don't initialize contracts on the home page
        setIsInitialized(true);
      }
    }

    initialize();
  }, [user, getEthereumProvider, ready, authenticated, pathname, router]);

  if (!isInitialized) {
    return <div className="text-black">Loading...</div>;
  }

  return <>{children}</>;
}
