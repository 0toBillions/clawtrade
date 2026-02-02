import { prisma } from '../config/database';
import { publicClient, walletClient } from '../config/blockchain';
import { websocketService, WebSocketEvent } from './websocket.service';
import { Address, parseEther, encodeFunctionData } from 'viem';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../../.env' });

const GROUP_VAULT_FACTORY_ADDRESS = process.env.GROUP_VAULT_FACTORY_ADDRESS as Address;
const PLATFORM_PRIVATE_KEY = process.env.PRIVATE_KEY_PLATFORM;

// GroupVaultFactory ABI
const FACTORY_ABI = [
  {
    name: 'createVault',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'groupName', type: 'string' },
      { name: 'admin', type: 'address' },
      { name: 'requiredApprovals', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'VaultCreated',
    type: 'event',
    inputs: [
      { name: 'vaultAddress', type: 'address', indexed: true },
      { name: 'groupName', type: 'string', indexed: false },
      { name: 'admin', type: 'address', indexed: true },
      { name: 'requiredApprovals', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

// GroupVault ABI
const VAULT_ABI = [
  {
    name: 'join',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'agentWallet', type: 'address' }],
    outputs: [],
  },
  {
    name: 'proposeTrade',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'dexRouter', type: 'address' },
      { name: 'swapData', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approveTrade',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'executeTrade',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getProposal',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      { name: 'proposer', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'approvals', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'executed', type: 'bool' },
      { name: 'cancelled', type: 'bool' },
    ],
  },
  {
    name: 'getAllMembers',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'totalShares',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'members',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'agentWallet', type: 'address' },
      { name: 'shares', type: 'uint256' },
      { name: 'contributionTimestamp', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
] as const;

interface CreateGroupInput {
  creatorAgentId: string;
  name: string;
  description: string;
  requiredApprovals: number;
}

interface JoinGroupInput {
  groupId: string;
  agentId: string;
  contributionEth: string;
}

interface ProposeTradeInput {
  groupId: string;
  proposerAgentId: string;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  minAmountOut: string;
  dexRouter: Address;
}

export class GroupService {
  /**
   * Create a new trading group (deploys vault contract)
   */
  async createGroup(input: CreateGroupInput) {
    const { creatorAgentId, name, description, requiredApprovals } = input;

    if (!GROUP_VAULT_FACTORY_ADDRESS) {
      throw new Error('GROUP_VAULT_FACTORY_ADDRESS not configured');
    }

    if (!PLATFORM_PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY_PLATFORM not configured');
    }

    // Validate creator exists
    const creator = await prisma.agent.findUnique({
      where: { id: creatorAgentId },
      select: { id: true, username: true, walletAddress: true },
    });

    if (!creator) {
      throw new Error('Creator agent not found');
    }

    console.log(`Creating trading group: ${name}`);
    console.log(`Admin: ${creator.walletAddress}`);
    console.log(`Required approvals: ${requiredApprovals}`);

    // Deploy vault via factory
    const { request } = await publicClient.simulateContract({
      address: GROUP_VAULT_FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'createVault',
      args: [name, creator.walletAddress as Address, BigInt(requiredApprovals)],
    });

    const hash = await walletClient.writeContract(request);
    console.log(`   Transaction hash: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   Confirmed in block ${receipt.blockNumber}`);

    // Extract vault address from event
    const log = receipt.logs.find((log) => {
      // VaultCreated event signature
      return log.topics[0] === '0x...'; // TODO: Add actual event signature
    });

    if (!log || !log.topics[1]) {
      throw new Error('Failed to get vault address from event');
    }

    const vaultAddress = `0x${log.topics[1].slice(26)}` as Address;
    console.log(`   Vault deployed at: ${vaultAddress}`);

    // Save to database
    const group = await prisma.tradingGroup.create({
      data: {
        name,
        description,
        vaultAddress: vaultAddress.toLowerCase(),
        requiredApprovals,
        totalValueUsd: 0,
        members: {
          create: {
            agentId: creatorAgentId,
            role: 'ADMIN',
            contributionUsd: 0,
            sharePercentage: 0,
          },
        },
      },
      include: {
        members: {
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
        },
      },
    });

    // Emit WebSocket event
    await websocketService.publishEvent(WebSocketEvent.GROUP_CREATED, {
      group,
    });

    console.log('✅ Trading group created!');

    return group;
  }

  /**
   * Join a trading group with ETH contribution
   */
  async joinGroup(input: JoinGroupInput) {
    const { groupId, agentId, contributionEth } = input;

    // Validate agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, username: true, walletAddress: true },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Get group
    const group = await prisma.tradingGroup.findUnique({
      where: { id: groupId },
      select: { vaultAddress: true },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const contributionWei = parseEther(contributionEth);

    console.log(`Agent ${agent.username} joining group...`);
    console.log(`Contribution: ${contributionEth} ETH`);

    // Call vault.join() with ETH
    const hash = await walletClient.writeContract({
      address: group.vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: 'join',
      args: [agent.walletAddress as Address],
      value: contributionWei,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    // Get member shares from contract
    const memberData = await publicClient.readContract({
      address: group.vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: 'members',
      args: [agent.walletAddress as Address],
    });

    const shares = memberData[1]; // shares is second element

    // Calculate share percentage
    const totalShares = await publicClient.readContract({
      address: group.vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: 'totalShares',
    });

    const sharePercentage = (Number(shares) / Number(totalShares)) * 100;
    const contributionUsd = Number(contributionEth) * 2500; // Assuming 1 ETH = $2500

    // Save member to database
    const member = await prisma.groupMember.create({
      data: {
        groupId,
        agentId,
        role: 'MEMBER',
        contributionUsd,
        sharePercentage,
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

    // Update group total value
    const currentValue = await publicClient.getBalance({
      address: group.vaultAddress as Address,
    });

    await prisma.tradingGroup.update({
      where: { id: groupId },
      data: {
        totalValueUsd: Number(currentValue) / 1e18 * 2500,
      },
    });

    // Emit WebSocket event
    await websocketService.publishEvent(WebSocketEvent.GROUP_MEMBER_JOINED, {
      groupId,
      member,
    });

    console.log('✅ Agent joined group!');

    return member;
  }

  /**
   * Propose a trade in a group
   */
  async proposeTrade(input: ProposeTradeInput) {
    const { groupId, proposerAgentId, tokenIn, tokenOut, amountIn, minAmountOut, dexRouter } = input;

    // Validate proposer
    const proposer = await prisma.agent.findUnique({
      where: { id: proposerAgentId },
      select: { id: true, username: true, walletAddress: true },
    });

    if (!proposer) {
      throw new Error('Proposer agent not found');
    }

    // Get group
    const group = await prisma.tradingGroup.findUnique({
      where: { id: groupId },
      select: { vaultAddress: true },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const amountInWei = parseEther(amountIn);
    const minAmountOutWei = parseEther(minAmountOut);

    // For now, we'll use empty swapData - in production this would be encoded Uniswap call data
    const swapData = '0x' as `0x${string}`;

    console.log(`Proposing trade in group...`);
    console.log(`  Swap: ${amountIn} ETH -> ${tokenOut}`);

    // Call vault.proposeTrade()
    const hash = await walletClient.writeContract({
      address: group.vaultAddress as Address,
      abi: VAULT_ABI,
      functionName: 'proposeTrade',
      args: [
        tokenIn, // address(0) for ETH
        tokenOut,
        amountInWei,
        minAmountOutWei,
        dexRouter,
        swapData,
      ],
      account: proposer.walletAddress as Address,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Extract proposal ID from logs (simplified - would need to decode properly)
    const proposalId = 0; // TODO: Extract from logs

    // Save proposal to database
    const proposal = await prisma.tradeProposal.create({
      data: {
        groupId,
        proposerAgentId: proposerAgentId,
        tokenInAddress: tokenIn.toLowerCase(),
        tokenOutAddress: tokenOut.toLowerCase(),
        amountIn: amountIn,
        minAmountOut: minAmountOut,
        status: 'PENDING',
        approvalCount: 0,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
      include: {
        proposer: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    // Emit WebSocket event
    await websocketService.publishEvent(WebSocketEvent.TRADE_PROPOSED, {
      groupId,
      proposal,
    });

    console.log('✅ Trade proposed!');

    return proposal;
  }

  /**
   * Get all trading groups
   */
  async getGroups(options: { limit?: number; offset?: number } = {}) {
    const { limit = 50, offset = 0 } = options;

    const [groups, total] = await Promise.all([
      prisma.tradingGroup.findMany({
        include: {
          members: {
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
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.tradingGroup.count(),
    ]);

    return {
      groups,
      total,
      limit,
      offset,
      hasMore: offset + groups.length < total,
    };
  }

  /**
   * Get group details by ID
   */
  async getGroup(groupId: string) {
    const group = await prisma.tradingGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
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
        },
        proposals: {
          include: {
            proposer: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
            approvals: {
              include: {
                agent: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    return group;
  }
}

export const groupService = new GroupService();
