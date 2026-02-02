import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ClawTrade contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy TokenFactory
  console.log("\n1. Deploying ClawTradeTokenFactory...");
  const TokenFactory = await ethers.getContractFactory("ClawTradeTokenFactory");
  const tokenFactory = await TokenFactory.deploy();
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log("✅ TokenFactory deployed to:", tokenFactoryAddress);

  // Deploy GroupVaultFactory
  console.log("\n2. Deploying ClawTradeGroupVaultFactory...");
  const VaultFactory = await ethers.getContractFactory("ClawTradeGroupVaultFactory");
  const vaultFactory = await VaultFactory.deploy();
  await vaultFactory.waitForDeployment();
  const vaultFactoryAddress = await vaultFactory.getAddress();
  console.log("✅ GroupVaultFactory deployed to:", vaultFactoryAddress);

  // Summary
  console.log("\n📋 Deployment Summary:");
  console.log("====================");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("TokenFactory:", tokenFactoryAddress);
  console.log("GroupVaultFactory:", vaultFactoryAddress);
  console.log("\n📝 Update your .env file with:");
  console.log(`TOKEN_FACTORY_ADDRESS=${tokenFactoryAddress}`);
  console.log(`GROUP_VAULT_FACTORY_ADDRESS=${vaultFactoryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
