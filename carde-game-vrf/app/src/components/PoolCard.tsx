"use client";

import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { getPoolStatus, type PoolAccount } from "@/lib/sdk";
import { lamportsToSol, shortenAddress } from "@/lib/utils";

export function PoolCard({ pool }: { pool: PoolAccount }) {
  const status = getPoolStatus(pool);
  const poolId = pool.poolId.toNumber();

  return (
    <Link href={`/pool/${poolId}`}>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-all hover:border-zinc-600 hover:bg-zinc-800/80 cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-zinc-400">Pool #{poolId}</span>
          <StatusBadge status={status} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">Prize</span>
            <span className="text-sm font-semibold text-white">
              {lamportsToSol(pool.prizePool).toFixed(4)} SOL
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">Tickets</span>
            <span className="text-sm text-white">
              {pool.totalTickets - pool.ticketLeft} / {pool.totalTickets}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-sm text-zinc-500">Ticket Price</span>
            <span className="text-sm text-white">
              {lamportsToSol(pool.ticketPrice).toFixed(4)} SOL
            </span>
          </div>

          {status === "settled" && pool.winner && (
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500">Winner</span>
              <span className="text-sm text-green-400 font-mono">
                {shortenAddress(pool.winner.toBase58())}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
