import { PrivyClientConfig } from "@privy-io/react-auth";

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["google"],
  fundingMethodConfig: {
    moonpay: {
      useSandbox: true,
    },
  },
  appearance: {
    accentColor: "#6A6FF5",
    theme: "#FFFFFF",
    showWalletLoginFirst: false,
    logo: "https://auth.privy.io/logos/privy-logo.png",
    walletChainType: "ethereum-only",
  },
  embeddedWallets: {
    createOnLogin: "all-users",
    requireUserPasswordOnCreate: false,
  },
  defaultChain: {
    id: 84532,
    name: "Base Sepolia",
    network: "base-sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: {
        http: ["https://sepolia.base.org"],
      },
      public: {
        http: ["https://sepolia.base.org"],
      },
    },
    blockExplorers: {
      default: {
        name: "BaseScan",
        url: "https://sepolia.basescan.org",
      },
    },
    testnet: true,
  },
  mfa: {
    noPromptOnMfaRequired: false,
  },
};
