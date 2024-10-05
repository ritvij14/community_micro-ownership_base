// test/test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Test Contract", function () {
  it("Should deploy with the correct initial message", async function () {
    const Test = await ethers.getContractFactory("Test");
    const test = await Test.deploy("Hello, Base!");

    await test.waitForDeployment();

    expect(await test.message()).to.equal("Hello, Base!");
  });

  it("Should update the message", async function () {
    const Test = await ethers.getContractFactory("Test");
    const test = await Test.deploy("Hello, Base!");

    await test.waitForDeployment();

    await test.setMessage("New Message");
    expect(await test.message()).to.equal("New Message");
  });
});
