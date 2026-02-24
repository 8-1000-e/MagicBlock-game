"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, type Idl } from "@coral-xyz/anchor";
import { fetchConfig, type ConfigAccount } from "@/lib/sdk";

export function useAdmin(program: Program<Idl> | null) {
  const { publicKey } = useWallet();
  const [config, setConfig] = useState<ConfigAccount | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      if (!program || !publicKey) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setConfig(null);
        setLoading(false);
        return;
      }

      try {
        const cfg = await fetchConfig(program);
        setConfig(cfg);
        const isSA = cfg.superAdmin.equals(publicKey);
        const isA = cfg.admins.some((a) => a.equals(publicKey));
        setIsSuperAdmin(isSA);
        setIsAdmin(isSA || isA);
      } catch {
        // Config not initialized yet
        setConfig(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    check();
  }, [program, publicKey]);

  return { config, isAdmin, isSuperAdmin, loading };
}
