import { prisma } from '../config/database';
import { blockchainService } from './blockchain.service';
import { priceService } from './price.service';
import { websocketService, WebSocketEvent } from './websocket.service';
import { Address } from 'viem';

interface TradeData {
  agentId: string;
  txHash: string;
  blockNumber: bigint;
  timestamp: Date;
  dex: string;
  type: 'SWAP' | 'TRANSFER';
  tokenInAddress: Address;
  tokenInSymbol: string;
  tokenInDecimals: number;
  amountIn: string;
  tokenOutAddress: Address;
  tokenOutSymbol: string;
  tokenOutDecimals: number;
  amountOut: string;
  valueUsd: number;
  profitLossUsd: number;
}

export class TradingService {
  /**
   * Index trades for a specific agent
   */
  async indexAgentTrades(agentId: string, walletAddress: Address): Promise<number> {
    try {
      console.log(`Indexing trades for agent ${agentId} (${walletAddress})...`);

      // Get the last indexed block for this agent
      const lastTrade = await prisma.trade.findFirst({
        where: { agentId },
        orderBy: { blockNumber: 'desc' },
      });

      const currentBlock = await blockchainService.getCurrentBlock();
      const fromBlock = lastTrade ? BigInt(lastTrade.blockNumber) + 1n : currentBlock - 10000n; // Last 10k blocks if first time

      console.log(`  Scanning blocks ${fromBlock} to ${currentBlock}...`);

      // Get swap events from blockchain
      const swaps = await blockchainService.getSwapEventsForAddress(
        walletAddress,
        fromBlock,
        currentBlock
      );

      console.log(`  Found ${swaps.length} potential swaps`);

      let indexed = 0;

      for (const swap of swaps) {
        // Check if trade already exists
        const existing = await prisma.trade.findUnique({
          where: { txHash: swap.txHash },
        });

        if (existing) {
          continue; // Skip duplicates
        }

        // Get token info
        const [tokenInInfo, tokenOutInfo] = await Promise.all([
          blockchainService.getTokenInfo(swap.tokenIn),
          blockchainService.getTokenInfo(swap.tokenOut),
        ]);

        if (!tokenInInfo || !tokenOutInfo) {
          console.log(`  Skipping ${swap.txHash}: Failed to get token info`);
          continue;
        }

        // Calculate USD values
        const [valueInUsd, valueOutUsd] = await Promise.all([
          priceService.calculateUsdValue(swap.tokenIn, swap.amountIn, tokenInInfo.decimals),
          priceService.calculateUsdValue(swap.tokenOut, swap.amountOut, tokenOutInfo.decimals),
        ]);

        const profitLossUsd = valueOutUsd - valueInUsd;

        // Create trade record
        const trade: TradeData = {
          agentId,
          txHash: swap.txHash,
          blockNumber: swap.blockNumber,
          timestamp: new Date(swap.timestamp * 1000),
          dex: 'UNISWAP_V2', // Simplified - would detect actual DEX
          type: 'SWAP',
          tokenInAddress: swap.tokenOut, // Note: swapped because agent is receiving tokenIn
          tokenInSymbol: tokenOutInfo.symbol,
          tokenInDecimals: tokenOutInfo.decimals,
          amountIn: swap.amountOut.toString(),
          tokenOutAddress: swap.tokenIn,
          tokenOutSymbol: tokenInInfo.symbol,
          tokenOutDecimals: tokenInInfo.decimals,
          amountOut: swap.amountIn.toString(),
          valueUsd: valueInUsd,
          profitLossUsd,
        };

        // Save to database
        const savedTrade = await prisma.trade.create({
          data: {
            agentId: trade.agentId,
            txHash: trade.txHash,
            blockNumber: Number(trade.blockNumber),
            timestamp: trade.timestamp,
            dex: trade.dex,
            type: trade.type,
            tokenInAddress: trade.tokenInAddress,
            tokenInSymbol: trade.tokenInSymbol,
            tokenInDecimals: trade.tokenInDecimals,
            amountIn: trade.amountIn,
            tokenOutAddress: trade.tokenOutAddress,
            tokenOutSymbol: trade.tokenOutSymbol,
            tokenOutDecimals: trade.tokenOutDecimals,
            amountOut: trade.amountOut,
            valueUsd: trade.valueUsd,
            profitLossUsd: trade.profitLossUsd,
          },
        });

        // Emit WebSocket event
        await websocketService.publishEvent(WebSocketEvent.TRADE_INDEXED, {
          agentId: trade.agentId,
          trade: savedTrade,
        });

        indexed++;
      }

      console.log(`  Indexed ${indexed} new trades`);

      // Update agent stats
      await this.updateAgentStats(agentId);

      return indexed;
    } catch (error) {
      console.error(`Failed to index trades for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Update agent trading stats (profit, volume, win rate)
   */
  async updateAgentStats(agentId: string): Promise<void> {
    try {
      // Calculate aggregate stats from all trades
      const trades = await prisma.trade.findMany({
        where: { agentId },
        select: {
          valueUsd: true,
          profitLossUsd: true,
        },
      });

      if (trades.length === 0) {
        return;
      }

      const totalVolume = trades.reduce((sum, t) => sum + Number(t.valueUsd), 0);
      const totalProfit = trades.reduce((sum, t) => sum + Number(t.profitLossUsd), 0);
      const profitableTrades = trades.filter((t) => Number(t.profitLossUsd) > 0).length;
      const winRate = (profitableTrades / trades.length) * 100;

      // Update agent
      const updatedAgent = await prisma.agent.update({
        where: { id: agentId },
        data: {
          totalVolumeUsd: totalVolume,
          totalProfitUsd: totalProfit,
          winRate,
          totalTrades: trades.length,
        },
        select: {
          id: true,
          username: true,
          totalVolumeUsd: true,
          totalProfitUsd: true,
          winRate: true,
          totalTrades: true,
        },
      });

      console.log(`  Updated stats for agent ${agentId}:`, {
        trades: trades.length,
        volume: `$${totalVolume.toFixed(2)}`,
        profit: `$${totalProfit.toFixed(2)}`,
        winRate: `${winRate.toFixed(1)}%`,
      });

      // Emit WebSocket events
      await websocketService.publishEvent(WebSocketEvent.AGENT_STATS_UPDATED, {
        agentId,
        stats: updatedAgent,
      });

      // Emit leaderboard update event
      await websocketService.publishEvent(WebSocketEvent.LEADERBOARD_UPDATED, {
        agentId,
        stats: updatedAgent,
      });
    } catch (error) {
      console.error(`Failed to update agent stats for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Index trades for all agents
   */
  async indexAllAgentTrades(): Promise<{ total: number; successful: number; failed: number }> {
    const agents = await prisma.agent.findMany({
      select: {
        id: true,
        walletAddress: true,
        username: true,
      },
    });

    console.log(`\n🔍 Indexing trades for ${agents.length} agents...`);

    let successful = 0;
    let failed = 0;
    let totalTrades = 0;

    for (const agent of agents) {
      try {
        const indexed = await this.indexAgentTrades(agent.id, agent.walletAddress as Address);
        totalTrades += indexed;
        successful++;
      } catch (error) {
        console.error(`Failed to index trades for ${agent.username}:`, error);
        failed++;
      }
    }

    console.log(`\n✅ Indexing complete:`, {
      totalAgents: agents.length,
      successful,
      failed,
      totalTradesIndexed: totalTrades,
    });

    return { total: agents.length, successful, failed };
  }
}

export const tradingService = new TradingService();
