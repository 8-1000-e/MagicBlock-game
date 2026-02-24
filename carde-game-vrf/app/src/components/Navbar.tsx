"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

function WalletBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }

    let active = true;

    async function fetch() {
      try {
        const lamports = await connection.getBalance(publicKey!);
        if (active) setBalance(lamports / LAMPORTS_PER_SOL);
      } catch {
        if (active) setBalance(null);
      }
    }

    fetch();
    const interval = setInterval(fetch, 8_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [connection, publicKey]);

  if (balance === null) return null;

  return (
    <span className="text-sm font-medium text-zinc-300">
      {balance.toFixed(3)} SOL
    </span>
  );
}

export function Navbar() {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-white">
            Carde Game
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
              Pools
            </Link>
            <Link href="/admin" className="text-zinc-400 hover:text-white transition-colors">
              Admin
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <WalletBalance />
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}
