import { BN } from "@coral-xyz/anchor";

const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: BN | number): number {
  const value = typeof lamports === "number" ? lamports : lamports.toNumber();
  return value / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): BN {
  return new BN(Math.round(sol * LAMPORTS_PER_SOL));
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
