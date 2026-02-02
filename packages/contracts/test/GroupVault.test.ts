import { expect } from "chai";
import { ethers } from "hardhat";
import { ClawTradeGroupVaultFactory, ClawTradeGroupVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ClawTradeGroupVault", function () {
  let factory: ClawTradeGroupVaultFactory;
  let vault: ClawTradeGroupVault;
  let admin: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;
  let agent3: SignerWithAddress;

  beforeEach(async function () {
    [admin, agent1, agent2, agent3] = await ethers.getSigners();

    // Deploy factory
    const Factory = await ethers.getContractFactory("ClawTradeGroupVaultFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();

    // Create a vault
    const tx = await factory.createVault("Test Group", admin.address, 2); // Require 2 approvals
    const receipt = await tx.wait();

    // Get vault address from event
    const event = receipt?.logs.find((log: any) => {
      try {
        return factory.interface.parseLog(log)?.name === "VaultCreated";
      } catch {
        return false;
      }
    });
    const parsedEvent = factory.interface.parseLog(event!);
    const vaultAddress = parsedEvent!.args.vaultAddress;

    vault = await ethers.getContractAt("ClawTradeGroupVault", vaultAddress);
  });

  describe("Vault Creation", function () {
    it("Should create vault with correct parameters", async function () {
      expect(await vault.groupName()).to.equal("Test Group");
      expect(await vault.admin()).to.equal(admin.address);
      expect(await vault.requiredApprovals()).to.equal(2);
    });

    it("Should track created vaults", async function () {
      expect(await factory.getTotalVaults()).to.equal(1);
      const vaults = await factory.getVaultsByCreator(admin.address);
      expect(vaults.length).to.equal(1);
    });
  });

  describe("Member Management", function () {
    it("Should allow joining with ETH", async function () {
      const joinAmount = ethers.parseEther("1");

      await expect(vault.connect(agent1).join(agent1.address, { value: joinAmount }))
        .to.emit(vault, "MemberJoined")
        .withArgs(agent1.address, joinAmount, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1));

      expect(await vault.isMember(agent1.address)).to.be.true;
      expect(await vault.totalShares()).to.equal(joinAmount);
    });

    it("Should reject joining without ETH", async function () {
      await expect(vault.connect(agent1).join(agent1.address, { value: 0 })).to.be.revertedWith(
        "Must contribute ETH"
      );
    });

    it("Should reject duplicate joins", async function () {
      await vault.connect(agent1).join(agent1.address, { value: ethers.parseEther("1") });

      await expect(
        vault.connect(agent1).join(agent1.address, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Already a member");
    });

    it("Should track multiple members", async function () {
      await vault.connect(agent1).join(agent1.address, { value: ethers.parseEther("1") });
      await vault.connect(agent2).join(agent2.address, { value: ethers.parseEther("2") });

      expect(await vault.getMemberCount()).to.equal(2);
      expect(await vault.totalShares()).to.equal(ethers.parseEther("3"));
    });
  });

  describe("Trade Proposals", function () {
    beforeEach(async function () {
      // Add members
      await vault.connect(agent1).join(agent1.address, { value: ethers.parseEther("1") });
      await vault.connect(agent2).join(agent2.address, { value: ethers.parseEther("1") });
      await vault.connect(agent3).join(agent3.address, { value: ethers.parseEther("1") });
    });

    it("Should allow members to propose trades", async function () {
      const tokenIn = ethers.ZeroAddress; // ETH
      const tokenOut = "0x0000000000000000000000000000000000000001";
      const amountIn = ethers.parseEther("0.1");

      await expect(
        vault.connect(agent1).proposeTrade(
          tokenIn,
          tokenOut,
          amountIn,
          0,
          admin.address, // Mock router
          "0x"
        )
      ).to.emit(vault, "TradeProposed");

      expect(await vault.proposalCount()).to.equal(1);
    });

    it("Should reject proposals from non-members", async function () {
      const nonMember = (await ethers.getSigners())[4];

      await expect(
        vault.connect(nonMember).proposeTrade(
          ethers.ZeroAddress,
          "0x0000000000000000000000000000000000000001",
          ethers.parseEther("0.1"),
          0,
          admin.address,
          "0x"
        )
      ).to.be.revertedWith("Not a member");
    });
  });

  describe("Trade Approvals", function () {
    let proposalId: number;

    beforeEach(async function () {
      await vault.connect(agent1).join(agent1.address, { value: ethers.parseEther("1") });
      await vault.connect(agent2).join(agent2.address, { value: ethers.parseEther("1") });
      await vault.connect(agent3).join(agent3.address, { value: ethers.parseEther("1") });

      const tx = await vault.connect(agent1).proposeTrade(
        ethers.ZeroAddress,
        "0x0000000000000000000000000000000000000001",
        ethers.parseEther("0.1"),
        0,
        admin.address,
        "0x"
      );
      await tx.wait();
      proposalId = 0;
    });

    it("Should allow members to approve proposals", async function () {
      await expect(vault.connect(agent2).approveTrade(proposalId))
        .to.emit(vault, "TradeApproved")
        .withArgs(proposalId, agent2.address);

      const proposal = await vault.getProposal(proposalId);
      expect(proposal.approvals).to.equal(1);
    });

    it("Should prevent double approvals", async function () {
      await vault.connect(agent2).approveTrade(proposalId);

      await expect(vault.connect(agent2).approveTrade(proposalId)).to.be.revertedWith(
        "Already approved"
      );
    });

    it("Should reject approvals from non-members", async function () {
      const nonMember = (await ethers.getSigners())[4];

      await expect(vault.connect(nonMember).approveTrade(proposalId)).to.be.revertedWith(
        "Not a member"
      );
    });
  });

  describe("Withdrawal", function () {
    beforeEach(async function () {
      await vault.connect(agent1).join(agent1.address, { value: ethers.parseEther("2") });
      await vault.connect(agent2).join(agent2.address, { value: ethers.parseEther("1") });
    });

    it("Should allow members to withdraw their share", async function () {
      const initialBalance = await ethers.provider.getBalance(agent1.address);
      const vaultBalance = await ethers.provider.getBalance(await vault.getAddress());

      // Agent1 has 2/3 of shares
      const expectedWithdraw = (vaultBalance * BigInt(2)) / BigInt(3);

      await expect(vault.connect(agent1).withdrawETH()).to.emit(vault, "FundsWithdrawn");

      // Check vault updated
      expect(await vault.isMember(agent1.address)).to.be.false;
      expect(await vault.totalShares()).to.equal(ethers.parseEther("1"));
    });
  });
});
