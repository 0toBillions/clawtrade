import { expect } from "chai";
import { ethers } from "hardhat";
import { ClawTradeTokenFactory, ClawTradeToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ClawTradeTokenFactory", function () {
  let factory: ClawTradeTokenFactory;
  let owner: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;

  beforeEach(async function () {
    [owner, agent1, agent2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ClawTradeTokenFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
  });

  describe("Token Creation", function () {
    it("Should create a new token successfully", async function () {
      const name = "Agent Token";
      const symbol = "AGT";
      const totalSupply = ethers.parseEther("1000000");
      const decimals = 18;

      const tx = await factory.connect(agent1).createToken(name, symbol, totalSupply, decimals);
      const receipt = await tx.wait();

      // Check event emission
      const event = receipt?.logs.find((log: any) => {
        try {
          return factory.interface.parseLog(log)?.name === "TokenCreated";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      // Verify token count
      expect(await factory.getTotalTokens()).to.equal(1);

      // Verify token info
      const tokenInfo = await factory.getTokenInfo(0);
      expect(tokenInfo.creator).to.equal(agent1.address);
      expect(tokenInfo.name).to.equal(name);
      expect(tokenInfo.symbol).to.equal(symbol);
      expect(tokenInfo.totalSupply).to.equal(totalSupply);
    });

    it("Should give all supply to creator", async function () {
      const totalSupply = ethers.parseEther("1000000");

      const tx = await factory.connect(agent1).createToken(
        "Test Token",
        "TEST",
        totalSupply,
        18
      );
      const receipt = await tx.wait();

      // Get token address from event
      const event = receipt?.logs.find((log: any) => {
        try {
          return factory.interface.parseLog(log)?.name === "TokenCreated";
        } catch {
          return false;
        }
      });
      const parsedEvent = factory.interface.parseLog(event!);
      const tokenAddress = parsedEvent!.args.tokenAddress;

      // Check balance
      const token = await ethers.getContractAt("ClawTradeToken", tokenAddress);
      expect(await token.balanceOf(agent1.address)).to.equal(totalSupply);
    });

    it("Should track tokens by creator", async function () {
      await factory.connect(agent1).createToken("Token1", "TK1", ethers.parseEther("100"), 18);
      await factory.connect(agent1).createToken("Token2", "TK2", ethers.parseEther("200"), 18);
      await factory.connect(agent2).createToken("Token3", "TK3", ethers.parseEther("300"), 18);

      const agent1Tokens = await factory.getTokensByCreator(agent1.address);
      const agent2Tokens = await factory.getTokensByCreator(agent2.address);

      expect(agent1Tokens.length).to.equal(2);
      expect(agent2Tokens.length).to.equal(1);
    });

    it("Should reject empty name", async function () {
      await expect(
        factory.createToken("", "SYM", ethers.parseEther("100"), 18)
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should reject empty symbol", async function () {
      await expect(
        factory.createToken("Name", "", ethers.parseEther("100"), 18)
      ).to.be.revertedWith("Symbol cannot be empty");
    });

    it("Should reject zero supply", async function () {
      await expect(
        factory.createToken("Name", "SYM", 0, 18)
      ).to.be.revertedWith("Total supply must be greater than 0");
    });

    it("Should reject decimals > 18", async function () {
      await expect(
        factory.createToken("Name", "SYM", ethers.parseEther("100"), 19)
      ).to.be.revertedWith("Decimals must be <= 18");
    });
  });

  describe("Token Verification", function () {
    it("Should correctly identify factory tokens", async function () {
      const tx = await factory.createToken("Test", "TST", ethers.parseEther("100"), 18);
      const receipt = await tx.wait();

      const event = receipt?.logs.find((log: any) => {
        try {
          return factory.interface.parseLog(log)?.name === "TokenCreated";
        } catch {
          return false;
        }
      });
      const parsedEvent = factory.interface.parseLog(event!);
      const tokenAddress = parsedEvent!.args.tokenAddress;

      expect(await factory.isFactoryToken(tokenAddress)).to.be.true;
      expect(await factory.isFactoryToken(ethers.ZeroAddress)).to.be.false;
    });
  });
});
