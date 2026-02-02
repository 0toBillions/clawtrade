import { prisma } from '../config/database';
import { publicClient } from '../config/blockchain';
import { websocketService, WebSocketEvent } from './websocket.service';
import { priceService } from './price.service';
import { Address, parseEther, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { Clanker } from 'clanker-sdk/v4';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../../.env' });

const PLATFORM_PRIVATE_KEY = process.env.PRIVATE_KEY_PLATFORM;
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface LaunchTokenInput {
  agentId: string;
  name: string;
  symbol: string;
  image?: string; // IPFS URL for token icon
  description?: string;
  initialBuyEth?: string; // Optional dev buy amount
}

export class TokenService {
  /**
   * Launch a new token using Clanker SDK
   * Automatically creates liquidity pool on Uniswap V3
   */
  async launchToken(input: LaunchTokenInput) {
    const {
      agentId,
      name,
      symbol,
      image,
      description,
      initialBuyEth = '0',
    } = input;

    if (!PLATFORM_PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY_PLATFORM not configured');
    }

    // Validate agent exists and get wallet
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, username: true, walletAddress: true },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    console.log(`Launching token: ${name} (${symbol}) via Clanker`);
    console.log(`Token admin: ${agent.walletAddress}`);

    // Initialize Clanker SDK
    const account = privateKeyToAccount(PLATFORM_PRIVATE_KEY as `0x${string}`);

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const clanker = new Clanker({
      publicClient,
      wallet: walletClient,
    });

    // Deploy token
    console.log('Deploying token via Clanker...');

    const deployParams: any = {
      name,
      symbol,
      tokenAdmin: agent.walletAddress as Address,
    };

    // Add optional image
    if (image) {
      deployParams.image = image;
    }

    // Add optional metadata
    if (description) {
      deployParams.metadata = {
        description,
      };
    }

    // Add optional dev buy
    if (initialBuyEth && parseFloat(initialBuyEth) > 0) {
      const buyAmount = parseEther(initialBuyEth);
      if (buyAmount >= parseEther('0.0001')) {
        deployParams.devBuy = buyAmount;
      }
    }

    const { txHash, waitForTransaction, error } = await clanker.deploy(deployParams);

    if (error) {
      console.error('Clanker deployment error:', error);
      throw new Error(`Token deployment failed: ${error.message || 'Unknown error'}`);
    }

    console.log(`   Transaction hash: ${txHash}`);
    console.log('   Waiting for confirmation...');

    // Wait for deployment to complete
    const result = await waitForTransaction();

    if (!result || !result.address) {
      throw new Error('Failed to get token address from deployment');
    }

    const tokenAddress = result.address;
    console.log(`   Token deployed at: ${tokenAddress}`);

    // Get initial token stats
    const totalSupply = await publicClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'totalSupply',
    });

    // Clanker tokens are 18 decimals by default
    const decimals = 18;
    const totalSupplyFormatted = Number(totalSupply) / 10 ** decimals;

    // Get initial price (Clanker creates pool with 10 ETH market cap by default)
    const initialMarketCapUsd = 10 * 2500; // Assuming 1 ETH = $2500
    const initialPriceUsd = initialMarketCapUsd / totalSupplyFormatted;

    // Save to database
    const launchedToken = await prisma.launchedToken.create({
      data: {
        agentId,
        tokenAddress: tokenAddress.toLowerCase(),
        name,
        symbol,
        totalSupply: totalSupplyFormatted.toString(),
        decimals,
        initialLiquidityUsd: initialMarketCapUsd,
        liquidityPoolAddress: '0x...', // Clanker creates the pool automatically
        deployTxHash: txHash,
        marketCapUsd: initialMarketCapUsd,
        priceUsd: initialPriceUsd,
        holders: 1,
      },
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Emit WebSocket event
    await websocketService.publishEvent(WebSocketEvent.TOKEN_LAUNCHED, {
      token: launchedToken,
    });

    console.log('✅ Token launch complete via Clanker!');
    console.log(`   Token: ${name} (${symbol})`);
    console.log(`   Address: ${tokenAddress}`);
    console.log(`   Initial Price: $${initialPriceUsd.toFixed(6)}`);
    console.log(`   Market Cap: $${initialMarketCapUsd.toFixed(2)}`);

    return launchedToken;
  }

  /**
   * Get all launched tokens with optional filters
   */
  async getTokens(options: {
    agentId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { agentId, limit = 50, offset = 0 } = options;

    const where: any = {};
    if (agentId) {
      where.agentId = agentId;
    }

    const [tokens, total] = await Promise.all([
      prisma.launchedToken.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { launchedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.launchedToken.count({ where }),
    ]);

    return {
      tokens,
      total,
      limit,
      offset,
      hasMore: offset + tokens.length < total,
    };
  }

  /**
   * Get token details by address
   */
  async getToken(tokenAddress: string) {
    const token = await prisma.launchedToken.findUnique({
      where: { tokenAddress: tokenAddress.toLowerCase() },
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!token) {
      throw new Error('Token not found');
    }

    return token;
  }

  /**
   * Update token price and market cap
   * Called by background worker
   */
  async updateTokenStats(tokenAddress: Address) {
    try {
      const token = await prisma.launchedToken.findUnique({
        where: { tokenAddress: tokenAddress.toLowerCase() },
      });

      if (!token) {
        return;
      }

      // Get current price from price service
      const priceUsd = await priceService.getTokenPriceUsd(tokenAddress);

      // Get total supply from contract
      const totalSupply = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      });

      const totalSupplyFormatted = Number(totalSupply) / 10 ** token.decimals;
      const marketCapUsd = priceUsd * totalSupplyFormatted;

      // Update database
      await prisma.launchedToken.update({
        where: { tokenAddress: tokenAddress.toLowerCase() },
        data: {
          priceUsd,
          marketCapUsd,
        },
      });

      console.log(`Updated ${token.symbol}: $${priceUsd.toFixed(6)} | MCap: $${marketCapUsd.toFixed(2)}`);

      // Emit WebSocket event for price update
      await websocketService.publishEvent(WebSocketEvent.TOKEN_STATS_UPDATED, {
        tokenAddress: tokenAddress.toLowerCase(),
        symbol: token.symbol,
        priceUsd,
        marketCapUsd,
      });
    } catch (error) {
      console.error(`Failed to update token stats for ${tokenAddress}:`, error);
    }
  }

  /**
   * Update all launched tokens' stats
   */
  async updateAllTokenStats() {
    const tokens = await prisma.launchedToken.findMany({
      select: { tokenAddress: true },
    });

    if (tokens.length === 0) {
      console.log('No tokens to update');
      return;
    }

    console.log(`Updating stats for ${tokens.length} tokens...`);

    for (const token of tokens) {
      await this.updateTokenStats(token.tokenAddress as Address);
    }

    console.log('Token stats update complete');
  }
}

export const tokenService = new TokenService();
