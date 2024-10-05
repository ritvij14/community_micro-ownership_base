import { ethers } from "hardhat";

async function main() {
  const Test = await ethers.getContractFactory("Test");
  const test = await Test.deploy("Hello, Base!");

  await test.deployed();

  console.log("Test contract deployed to:", test.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
