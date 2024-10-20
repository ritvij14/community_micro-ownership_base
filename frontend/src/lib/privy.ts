import { PrivyClientConfig } from "@privy-io/react-auth";

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["google"],
  appearance: {
    theme: "light",
    accentColor: "#676FFF",
    logo: "https://auth.privy.io/logos/privy-logo.png",
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
  supportedChains: [
    {
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
  ],
  // Add these new configurations
  embeddedWallets: {
    createOnLogin: "users-without-wallets",
    noPromptOnSignature: true,
  },
  walletConnectCloudProjectId: undefined,
};
