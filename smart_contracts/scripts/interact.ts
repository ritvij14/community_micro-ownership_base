import { ethers } from "hardhat";
import { Test } from "../typechain/Test";

async function main() {
  const contractAddress = "0xAc9698277a87F07ECA5867874B2f72818FDbc73E";
  const TestFactory = await ethers.getContractFactory("Test");
  const test = TestFactory.attach(contractAddress) as Test;

  // Read the current message
  const currentMessage = await test.message();
  console.log("Current message:", currentMessage);

  // Update the message
  const tx = await test.setMessage("Hello, Sepolia!");
  await tx.wait();

  // Verify the update
  const newMessage = await test.message();
  console.log("Updated message:", newMessage);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
