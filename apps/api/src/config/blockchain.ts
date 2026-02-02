import { createPublicClient, http, Chain } from 'viem';
import { base, baseSepolia } from 'viem/chains';

const CHAIN_ID = parseInt(process.env.BASE_CHAIN_ID || '84532', 10);

// Select chain based on environment
const chain: Chain = CHAIN_ID === 8453 ? base : baseSepolia;

const rpcUrl =
  CHAIN_ID === 8453
    ? process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    : process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

// Create public client for reading blockchain data
export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl, {
    batch: true,
    retryCount: 3,
  }),
});

// Contract addresses (update after deployment)
export const CONTRACTS = {
  TOKEN_FACTORY: (process.env.TOKEN_FACTORY_ADDRESS || '') as `0x${string}`,
  GROUP_VAULT_FACTORY: (process.env.GROUP_VAULT_FACTORY_ADDRESS || '') as `0x${string}`,
};

export const CHAIN_CONFIG = {
  id: CHAIN_ID,
  name: chain.name,
  rpcUrl,
  explorer: chain.blockExplorers?.default.url,
};

// Uniswap Router addresses on Base
export const UNISWAP_V2_ROUTER = '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24' as const;
export const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481' as const;
export const UNISWAP_V2_FACTORY = '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6' as const;

// Common token addresses on Base Mainnet
export const BASE_TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
} as const;

// Event signatures
export const EVENT_SIGNATURES = {
  SWAP: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
  TRANSFER: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
} as const;

// ABIs
export const ERC20_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const UNISWAP_V2_PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

console.log('✅ Blockchain client configured:', {
  chain: CHAIN_CONFIG.name,
  chainId: CHAIN_CONFIG.id,
  rpcUrl,
});

export default publicClient;
