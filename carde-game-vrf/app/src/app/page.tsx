"use client";

import { useEffect, useState, useMemo } from "react";
import { useProgram } from "@/hooks/useProgram";
import { usePools } from "@/hooks/usePools";
import { useAdmin } from "@/hooks/useAdmin";
import { useEvents } from "@/hooks/useEvents";
import { PoolCard } from "@/components/PoolCard";
import { EventFeed } from "@/components/EventFeed";
import { getPoolStatus } from "@/lib/sdk";
import Link from "next/link";

type TimeFilter = "all" | "1m" | "5m" | "1h" | "24h";
type StatusFilter = "all" | "open" | "pendingVrf" | "settled" | "cancelled";

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "1m", label: "< 1 min" },
  { value: "5m", label: "< 5 min" },
  { value: "1h", label: "< 1 hour" },
  { value: "24h", label: "< 24h" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "pendingVrf", label: "Pending" },
  { value: "settled", label: "Settled" },
  { value: "cancelled", label: "Cancelled" },
];

const TIME_FILTER_MS: Record<TimeFilter, number> = {
  all: Infinity,
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

export default function HomePage() {
  const program = useProgram();
  const { pools, loading, error, refresh } = usePools(program);
  const { isAdmin } = useAdmin(program);
  const { events } = useEvents(program);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [now, setNow] = useState(Date.now());

  // Tick every 10s so time filters stay accurate
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh when a new pool is created or a pool status changes
  useEffect(() => {
    if (events.length > 0) {
      const latest = events[0];
      if (
        latest.type === "poolCreated" ||
        latest.type === "ticketResolved" ||
        latest.type === "poolCancelled"
      ) {
        refresh();
      }
    }
  }, [events, refresh]);

  const filteredPools = useMemo(() => {
    return pools.filter((p) => {
      // Status filter
      if (statusFilter !== "all") {
        const status = getPoolStatus(p.account);
        if (status !== statusFilter) return false;
      }

      // Time filter — based on createdAt timestamp
      if (timeFilter !== "all") {
        const createdAtMs = p.account.createdAt.toNumber() * 1000;
        const age = now - createdAtMs;
        if (age > TIME_FILTER_MS[timeFilter]) return false;
      }

      return true;
    });
  }, [pools, timeFilter, statusFilter, now]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pools</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {filteredPools.length} of {pools.length} pool{pools.length !== 1 && "s"} on devnet
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refresh}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Refresh
          </button>
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              Create Pool
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Time:</span>
          <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
            {TIME_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTimeFilter(f.value)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  timeFilter === f.value
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Status:</span>
          <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  statusFilter === f.value
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live event feed */}
      <EventFeed events={events} />

      {!program && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">Connect your wallet to view pools</p>
        </div>
      )}

      {loading && program && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">Loading pools...</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/50 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loading && pools.length === 0 && program && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">No pools yet. Create one from the Admin panel.</p>
        </div>
      )}

      {!loading && pools.length > 0 && filteredPools.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">No pools match the selected filters.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPools.map((p) => (
          <PoolCard key={p.publicKey} pool={p.account} />
        ))}
      </div>
    </div>
  );
}
