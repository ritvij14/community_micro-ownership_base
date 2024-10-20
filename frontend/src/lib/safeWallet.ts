import { EIP1193Provider } from "@privy-io/react-auth";
import Safe, {
  SafeAccountConfig,
  SafeFactory,
} from "@safe-global/safe-core-sdk";
import EthersAdapter from "@safe-global/safe-ethers-lib";
import SafeServiceClient from "@safe-global/safe-service-client";
import { ethers } from "ethers";

// Replace with the actual Safe transaction service URL for Base Sepolia
const txServiceUrl = "https://safe-transaction-base-sepolia.safe.global";

let safeService: SafeServiceClient;
let ethAdapter: EthersAdapter;
let safeSdk: Safe;

export async function initializeSafeSDK(provider: EIP1193Provider) {
  const ethersProvider = new ethers.providers.Web3Provider(provider);
  const signer = ethersProvider.getSigner();

  ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer,
  });

  safeService = new SafeServiceClient({
    txServiceUrl,
    ethAdapter,
  });
}

export async function createSafeWallet(owners: string[], threshold: number) {
  if (!ethAdapter) {
    throw new Error("Safe SDK not initialized");
  }

  const safeFactory = await SafeFactory.create({ ethAdapter });
  const safeAccountConfig: SafeAccountConfig = {
    owners,
    threshold,
  };

  const safeSdk = await safeFactory.deploySafe({ safeAccountConfig });
  const newSafeAddress = await safeSdk.getAddress();
  return newSafeAddress;
}

export async function transferFunds(
  safeAddress: string,
  to: string,
  amount: string
) {
  if (!ethAdapter) {
    throw new Error("Safe SDK not initialized");
  }

  const safeSdk = await Safe.create({
    ethAdapter,
    safeAddress,
  });

  const safeTransactionData = {
    to,
    data: "0x",
    value: ethers.utils.parseEther(amount).toString(),
  };

  const safeTransaction = await safeSdk.createTransaction({
    safeTransactionData,
  });
  const signedSafeTransaction = await safeSdk.signTransaction(safeTransaction);

  const executeTxResponse = await safeSdk.executeTransaction(
    signedSafeTransaction
  );
  await executeTxResponse.transactionResponse?.wait();

  return executeTxResponse.hash;
}

export async function getSafeWalletBalance(
  safeAddress: string,
  provider: EIP1193Provider
): Promise<string> {
  try {
    if (!ethAdapter) {
      throw new Error("Safe SDK not initialized");
    }

    const ethersProvider = new ethers.providers.Web3Provider(provider);
    const balance = await ethersProvider.getBalance(safeAddress);
    const ethBalance = ethers.utils.formatEther(balance);

    // Mock exchange rate: 1 ETH = $2000 USD
    const mockExchangeRate = 2000;
    const usdBalance = parseFloat(ethBalance) * mockExchangeRate;

    return usdBalance.toFixed(2);
  } catch (error) {
    console.error("Error fetching Safe wallet balance:", error);
    throw error;
  }
}
