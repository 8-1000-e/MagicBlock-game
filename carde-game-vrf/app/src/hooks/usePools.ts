"use client";

import { useState, useEffect, useCallback } from "react";
import { Program, type Idl } from "@coral-xyz/anchor";
import { fetchAllPools, type PoolAccount } from "@/lib/sdk";

export type PoolWithKey = {
  publicKey: string;
  account: PoolAccount;
};

export function usePools(program: Program<Idl> | null) {
  const [pools, setPools] = useState<PoolWithKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!program) {
      setPools([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const allPools = await fetchAllPools(program);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = allPools.map((p: any) => ({
        publicKey: p.publicKey.toBase58(),
        account: p.account as unknown as PoolAccount,
      }));
      // Sort by pool_id descending (newest first)
      mapped.sort((a: PoolWithKey, b: PoolWithKey) => b.account.poolId.toNumber() - a.account.poolId.toNumber());
      setPools(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch pools");
    } finally {
      setLoading(false);
    }
  }, [program]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { pools, loading, error, refresh };
}
