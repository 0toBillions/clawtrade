import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../.env' });

const PRIVATE_KEY = process.env.PRIVATE_KEY_PLATFORM;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY_PLATFORM not found in .env file');
}

// Read compiled contract
const contractPath = path.join(__dirname, '../artifacts/contracts/ClawTradeTokenFactory.sol/ClawTradeTokenFactory.json');
const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const abi = contractJson.abi;
const bytecode = contractJson.bytecode;

async function main() {
  console.log('\n🚀 Deploying ClawTradeTokenFactory to Base Sepolia\n');
  console.log('='.repeat(60));

  // Setup account
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  console.log(`\n📝 Deploying from: ${account.address}`);

  // Setup clients
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${Number(balance) / 1e18} ETH`);

  if (balance < parseEther('0.001')) {
    console.error('\n❌ Insufficient balance. Need at least 0.001 ETH for deployment.');
    console.log('   Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
    process.exit(1);
  }

  // Deploy contract
  console.log('\n⏳ Deploying TokenFactory contract...');

  const hash = await walletClient.deployContract({
    abi,
    bytecode: bytecode as `0x${string}`,
    args: [],
  });

  console.log(`   Transaction hash: ${hash}`);

  // Wait for confirmation
  console.log('   Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'reverted') {
    console.error('\n❌ Deployment failed!');
    process.exit(1);
  }

  const contractAddress = receipt.contractAddress;
  console.log(`\n✅ TokenFactory deployed successfully!`);
  console.log(`   Contract address: ${contractAddress}`);
  console.log(`   Block number: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed}`);

  // Save deployment info
  const deploymentInfo = {
    network: 'base-sepolia',
    chainId: baseSepolia.id,
    contractAddress,
    deployerAddress: account.address,
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, '../deployments/token-factory.json');
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n📄 Deployment info saved to: ${deploymentPath}`);

  // Verification instructions
  console.log('\n📋 To verify on Basescan:');
  console.log(`   npx hardhat verify --network base-sepolia ${contractAddress}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Deployment complete!\n');

  console.log('🔧 Add to .env file:');
  console.log(`TOKEN_FACTORY_ADDRESS=${contractAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
