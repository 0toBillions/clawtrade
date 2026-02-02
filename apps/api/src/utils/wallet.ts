/**
 * Wallet generation and management utilities
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { encryptPrivateKey, decryptPrivateKey } from './encryption';

export interface GeneratedWallet {
  address: string;
  privateKey: string;
  encryptedPrivateKey: string;
}

/**
 * Generate a new wallet for an agent
 * @returns Wallet with address, private key, and encrypted private key
 */
export function generateWallet(): GeneratedWallet {
  try {
    // Generate random private key
    const privateKey = generatePrivateKey();

    // Create account from private key
    const account = privateKeyToAccount(privateKey);

    // Encrypt private key for storage
    const encryptedPrivateKey = encryptPrivateKey(privateKey);

    return {
      address: account.address,
      privateKey, // Only used during registration, not stored
      encryptedPrivateKey,
    };
  } catch (error) {
    throw new Error(
      `Failed to generate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get account from encrypted private key
 * @param encryptedPrivateKey - Encrypted private key from database
 * @returns viem Account object for signing transactions
 */
export function getAccountFromEncrypted(encryptedPrivateKey: string) {
  try {
    const privateKey = decryptPrivateKey(encryptedPrivateKey);
    return privateKeyToAccount(privateKey as `0x${string}`);
  } catch (error) {
    throw new Error(
      `Failed to get account: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate private key format
 */
export function isValidPrivateKey(privateKey: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(privateKey);
}
