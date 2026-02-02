import { Address } from 'viem';
import { publicClient, UNISWAP_V2_PAIR_ABI, BASE_TOKENS } from '../config/blockchain';

interface TokenPrice {
  token: Address;
  priceUsd: number;
  source: 'coingecko' | 'uniswap' | 'cache';
  timestamp: number;
}

export class PriceService {
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get token price in USD
   */
  async getTokenPriceUsd(tokenAddress: Address): Promise<number> {
    const cacheKey = tokenAddress.toLowerCase();

    // Check cache first
    const cached = this.priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    // Try to get price from Uniswap pool
    let price = await this.getPriceFromUniswap(tokenAddress);

    // Fallback to hardcoded prices for common tokens
    if (price === 0) {
      price = this.getFallbackPrice(tokenAddress);
    }

    // Cache the price
    if (price > 0) {
      this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
    }

    return price;
  }

  /**
   * Get price from Uniswap V2 pool
   */
  private async getPriceFromUniswap(tokenAddress: Address): Promise<number> {
    try {
      // For simplicity, we'll calculate price against WETH
      // In production, you'd want to find the best liquidity pool

      // Get WETH price first (assume $2500 for now, or fetch from CoinGecko)
      const wethPriceUsd = await this.getWethPrice();

      // Check if token is WETH itself
      if (tokenAddress.toLowerCase() === BASE_TOKENS.WETH.toLowerCase()) {
        return wethPriceUsd;
      }

      // Check if token is a stablecoin
      if (
        tokenAddress.toLowerCase() === BASE_TOKENS.USDC.toLowerCase() ||
        tokenAddress.toLowerCase() === BASE_TOKENS.DAI.toLowerCase() ||
        tokenAddress.toLowerCase() === BASE_TOKENS.USDT.toLowerCase()
      ) {
        return 1.0; // Stablecoins = $1
      }

      // For other tokens, try to find WETH pair
      // This is a simplified approach - production would use factory.getPair()
      // For now, return 0 to indicate price not found
      return 0;
    } catch (error) {
      console.error(`Failed to get Uniswap price for ${tokenAddress}:`, error);
      return 0;
    }
  }

  /**
   * Get WETH price in USD (fallback to fixed price or CoinGecko)
   */
  private async getWethPrice(): Promise<number> {
    try {
      // Try CoinGecko API (free tier, rate limited)
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
      );

      if (response.ok) {
        const data = await response.json();
        return data.ethereum?.usd || 2500;
      }
    } catch (error) {
      console.error('Failed to fetch ETH price from CoinGecko:', error);
    }

    // Fallback to approximate price
    return 2500;
  }

  /**
   * Get fallback prices for common tokens
   */
  private getFallbackPrice(tokenAddress: Address): number {
    const addr = tokenAddress.toLowerCase();

    // Stablecoins
    if (
      addr === BASE_TOKENS.USDC.toLowerCase() ||
      addr === BASE_TOKENS.DAI.toLowerCase() ||
      addr === BASE_TOKENS.USDT.toLowerCase()
    ) {
      return 1.0;
    }

    // WETH
    if (addr === BASE_TOKENS.WETH.toLowerCase()) {
      return 2500; // Approximate ETH price
    }

    // Unknown token - return 0
    return 0;
  }

  /**
   * Get multiple token prices at once
   */
  async getTokenPrices(tokenAddresses: Address[]): Promise<Map<Address, number>> {
    const prices = new Map<Address, number>();

    await Promise.all(
      tokenAddresses.map(async (address) => {
        const price = await this.getTokenPriceUsd(address);
        prices.set(address, price);
      })
    );

    return prices;
  }

  /**
   * Calculate USD value of token amount
   */
  async calculateUsdValue(tokenAddress: Address, amount: bigint, decimals: number): Promise<number> {
    const price = await this.getTokenPriceUsd(tokenAddress);
    const tokenAmount = Number(amount) / 10 ** decimals;
    return tokenAmount * price;
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.priceCache.clear();
  }
}

export const priceService = new PriceService();
