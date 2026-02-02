import { publicClient, ERC20_ABI, EVENT_SIGNATURES } from '../config/blockchain';
import { Address, formatUnits, parseAbiItem } from 'viem';

interface SwapEvent {
  txHash: string;
  blockNumber: bigint;
  timestamp: number;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  from: Address;
  to: Address;
}

interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
}

export class BlockchainService {
  /**
   * Get swap events for an address within a block range
   */
  async getSwapEventsForAddress(
    address: Address,
    fromBlock: bigint,
    toBlock: bigint | 'latest' = 'latest'
  ): Promise<SwapEvent[]> {
    try {
      const swaps: SwapEvent[] = [];

      // Get all Transfer events where the address is sender or recipient
      const transfersOut = await publicClient.getLogs({
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
        args: {
          from: address,
        },
        fromBlock,
        toBlock,
      });

      const transfersIn = await publicClient.getLogs({
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
        args: {
          to: address,
        },
        fromBlock,
        toBlock,
      });

      // Combine and group by transaction hash
      const allTransfers = [...transfersOut, ...transfersIn];
      const txGroups = new Map<string, typeof allTransfers>();

      for (const transfer of allTransfers) {
        const txHash = transfer.transactionHash;
        if (!txGroups.has(txHash)) {
          txGroups.set(txHash, []);
        }
        txGroups.get(txHash)!.push(transfer);
      }

      // Parse each transaction for swap patterns
      for (const [txHash, transfers] of txGroups.entries()) {
        if (transfers.length >= 2) {
          // Potential swap detected
          const swap = await this.parseSwapFromTransfers(txHash as `0x${string}`, transfers, address);
          if (swap) {
            swaps.push(swap);
          }
        }
      }

      return swaps.sort((a, b) => Number(a.blockNumber - b.blockNumber));
    } catch (error) {
      console.error('Failed to get swap events:', error);
      return [];
    }
  }

  /**
   * Parse swap from transfer events
   */
  private async parseSwapFromTransfers(
    txHash: `0x${string}`,
    transfers: any[],
    agentAddress: Address
  ): Promise<SwapEvent | null> {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      const tx = await publicClient.getTransaction({ hash: txHash });
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });

      // Find transfers out (agent sending tokens)
      const transfersOut = transfers.filter(
        (t) => t.args.from?.toLowerCase() === agentAddress.toLowerCase()
      );

      // Find transfers in (agent receiving tokens)
      const transfersIn = transfers.filter(
        (t) => t.args.to?.toLowerCase() === agentAddress.toLowerCase()
      );

      if (transfersOut.length > 0 && transfersIn.length > 0) {
        // This looks like a swap
        const tokenOut = transfersOut[0].address; // Token sent
        const tokenIn = transfersIn[transfersIn.length - 1].address; // Token received
        const amountOut = transfersOut[0].args.value;
        const amountIn = transfersIn[transfersIn.length - 1].args.value;

        return {
          txHash,
          blockNumber: receipt.blockNumber,
          timestamp: Number(block.timestamp),
          tokenIn,
          tokenOut,
          amountIn,
          amountOut,
          from: tx.from,
          to: tx.to || '0x0000000000000000000000000000000000000000',
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to parse swap from ${txHash}:`, error);
      return null;
    }
  }

  /**
   * Get token info (name, symbol, decimals)
   */
  async getTokenInfo(tokenAddress: Address): Promise<TokenInfo | null> {
    try {
      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'name',
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }),
      ]);

      return {
        address: tokenAddress,
        name,
        symbol,
        decimals,
      };
    } catch (error) {
      console.error(`Failed to get token info for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<bigint> {
    return await publicClient.getBlockNumber();
  }

  /**
   * Format token amount with decimals
   */
  formatTokenAmount(amount: bigint, decimals: number): string {
    return formatUnits(amount, decimals);
  }

  /**
   * Get ETH balance for address
   */
  async getEthBalance(address: Address): Promise<bigint> {
    return await publicClient.getBalance({ address });
  }
}

export const blockchainService = new BlockchainService();
