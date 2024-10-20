"use client";

import { privyConfig } from "@/lib/privy";
import { PrivyProvider } from "@privy-io/react-auth";
import AuthWrapper from "./AuthWrapper";

export default function PrivyProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={privyConfig}
    >
      <AuthWrapper>{children}</AuthWrapper>
    </PrivyProvider>
  );
}
