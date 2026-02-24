"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/hooks/useProgram";
import { useAdmin } from "@/hooks/useAdmin";
import { useEvents } from "@/hooks/useEvents";
import { StatusBadge } from "@/components/StatusBadge";
import { EventFeed } from "@/components/EventFeed";
import { fetchPool, buyTicket, cancelPool, getPoolStatus, type PoolAccount } from "@/lib/sdk";
import { lamportsToSol, shortenAddress, sleep } from "@/lib/utils";

type RevealState = "idle" | "sending" | "waiting" | "revealing" | "won" | "lost";

const LOSE_MESSAGES = [
  "Not this time... The odds will turn!",
  "So close! Try again, luck is brewing.",
  "The VRF gods said no. Next one's yours?",
  "Tough break. The pool grows thicker...",
  "Miss! But someone has to win eventually.",
  "Nope! Your SOL made the prize juicier though.",
];

function randomLoseMsg() {
  return LOSE_MESSAGES[Math.floor(Math.random() * LOSE_MESSAGES.length)];
}

export default function PoolDetailPage() {
  const params = useParams();
  const poolId = new BN(params.id as string);
  const program = useProgram();
  const { publicKey } = useWallet();
  const { isAdmin } = useAdmin(program);
  const { events } = useEvents(program);

  const [pool, setPool] = useState<PoolAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reveal animation state
  const [reveal, setReveal] = useState<RevealState>("idle");
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [wonAmount, setWonAmount] = useState<number | null>(null);

  // Ref to track reveal state inside async loops (avoids stale closures)
  const revealRef = useRef<RevealState>("idle");
  const resolvedRef = useRef(false);

  function updateReveal(state: RevealState) {
    revealRef.current = state;
    setReveal(state);
  }

  const loadPool = useCallback(async () => {
    if (!program) return;
    try {
      const p = await fetchPool(program, poolId);
      setPool(p);
      return p;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch pool");
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, poolId.toString()]);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  // Shared function to show the reveal result
  async function showResult(won: boolean, prize: number) {
    // Guard against double-resolve (event + polling racing)
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    updateReveal("revealing");
    await sleep(800);

    if (won) {
      updateReveal("won");
      setWonAmount(prize);
      setResultMsg(null);
    } else {
      updateReveal("lost");
      setResultMsg(randomLoseMsg());
    }

    // Refresh pool data in background (don't block the result display)
    loadPool();

    // Only auto-dismiss losses. Wins stay until user interacts.
    if (!won) {
      await sleep(8000);
      // Only dismiss if still showing loss (user might have clicked Try Again)
      if (revealRef.current === "lost") {
        updateReveal("idle");
        setResultMsg(null);
        setWonAmount(null);
      }
    }
  }

  // Listen for TicketResolved events on this pool — faster than polling
  useEffect(() => {
    if (events.length === 0) return;
    if (revealRef.current !== "waiting") return;

    const latest = events[0];
    if (
      latest.type === "ticketResolved" &&
      latest.data.poolId.toString() === poolId.toString()
    ) {
      showResult(
        latest.data.won,
        latest.data.won ? lamportsToSol(latest.data.prize) : 0
      );
    }
  }, [events]);

  async function handleBuy() {
    if (!program || !pool) return;
    // Snapshot prize before buying — after settle, prizePool is 0 on-chain
    const prizeSnapshot = lamportsToSol(pool.prizePool) + lamportsToSol(pool.ticketPrice);
    updateReveal("sending");
    resolvedRef.current = false;
    setError(null);
    setResultMsg(null);
    setWonAmount(null);

    try {
      await buyTicket(program, poolId);
      updateReveal("waiting");

      // Fallback polling in case event listener misses it
      for (let i = 0; i < 36; i++) {
        await sleep(5000);

        // If already resolved by event listener, stop
        if (resolvedRef.current) return;

        try {
          const updated = await fetchPool(program, poolId);
          // Update pool data during polling so user sees changes
          setPool(updated);
          const status = getPoolStatus(updated);

          if (status !== "pendingVrf") {
            const won = !!(
              status === "settled" &&
              updated.winner &&
              publicKey &&
              updated.winner.equals(publicKey)
            );
            // Use snapshot for win amount since prizePool is 0 after settle
            await showResult(won, won ? prizeSnapshot : 0);
            return;
          }
        } catch {
          // continue polling
        }
      }

      // Timeout — still no result
      if (!resolvedRef.current) {
        updateReveal("idle");
        setError("VRF timeout. Refresh to check the result.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      updateReveal("idle");
    }
  }

  async function handleCancel() {
    if (!program) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelPool(program, poolId);
      setResultMsg("Pool cancelled successfully");
      await loadPool();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  if (!program) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-zinc-400">Connect your wallet to view this pool</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-zinc-400">Loading pool...</p>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/50 p-8 text-center">
        <p className="text-red-400">Pool not found</p>
      </div>
    );
  }

  const status = getPoolStatus(pool);
  const isCreator = publicKey && pool.creator.equals(publicKey);
  const isWinner = status === "settled" && pool.winner && publicKey && pool.winner.equals(publicKey);
  const canCancel = isCreator && status === "open" && pool.ticketLeft === pool.totalTickets;
  const canBuy = status === "open" && reveal === "idle";
  const isBusy = reveal === "sending" || reveal === "waiting" || reveal === "revealing";

  const poolEvents = events.filter(
    (e) => e.data.poolId.toString() === poolId.toString()
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pool #{poolId.toString()}</h1>
          <StatusBadge status={status} />
        </div>

        {/* Winner banner (permanent, for settled pools when idle) */}
        {isWinner && reveal === "idle" && (
          <div className="rounded-lg bg-green-500/20 border border-green-500/30 p-4 text-center">
            <p className="text-xl font-bold text-green-400">YOU WON!</p>
            <p className="text-sm text-green-300 mt-1">
              Prize: {lamportsToSol(pool.prizePool).toFixed(4)} SOL
            </p>
          </div>
        )}

        {/* ── REVEAL ANIMATION ZONE ── */}
        {isBusy && (
          <div className="relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 p-8">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-purple-500/10 to-yellow-500/5 animate-pulse" />

            <div className="relative flex flex-col items-center gap-4">
              {reveal === "sending" && (
                <>
                  <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-400 border-t-transparent" />
                  <p className="text-blue-400 font-medium">Sending transaction...</p>
                  <p className="text-xs text-zinc-500">Confirm in your wallet</p>
                </>
              )}

              {reveal === "waiting" && (
                <>
                  <div className="relative h-20 w-20">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 animate-bounce shadow-lg shadow-yellow-500/30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-zinc-900">?</span>
                    </div>
                  </div>
                  <p className="text-yellow-400 font-medium animate-pulse">
                    VRF drawing in progress...
                  </p>
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-2 w-2 rounded-full bg-yellow-400"
                        style={{
                          animation: `bounce 1s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500">
                    The oracle is rolling the dice...
                  </p>
                </>
              )}

              {reveal === "revealing" && (
                <>
                  <div className="relative h-20 w-20">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 animate-ping opacity-40" />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 animate-spin" />
                  </div>
                  <p className="text-purple-400 font-bold text-lg animate-pulse">
                    Revealing...
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* WIN result */}
        {reveal === "won" && (
          <div className="relative overflow-hidden rounded-xl border-2 border-green-400 bg-green-950/40 p-8 text-center">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/20 to-green-500/10 animate-pulse" />
            <div className="relative space-y-3">
              <div className="text-5xl">W</div>
              <p className="text-2xl font-bold text-green-400">YOU WON!</p>
              {wonAmount !== null && wonAmount > 0 && (
                <p className="text-lg text-green-300">
                  +{wonAmount.toFixed(4)} SOL
                </p>
              )}
              <p className="text-sm text-green-400/60">
                Prize has been sent to your wallet
              </p>
              <button
                onClick={() => {
                  updateReveal("idle");
                  setWonAmount(null);
                }}
                className="mt-3 rounded-lg border border-green-500/30 px-4 py-2 text-sm text-green-300 hover:bg-green-500/10 transition-colors"
              >
                Nice!
              </button>
            </div>
          </div>
        )}

        {/* LOSE result */}
        {reveal === "lost" && (
          <div className="relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 p-8 text-center">
            <div className="relative space-y-3">
              <div className="text-4xl opacity-60">~</div>
              <p className="text-lg font-medium text-zinc-300">Better luck next time</p>
              {resultMsg && (
                <p className="text-sm text-zinc-500 italic">{resultMsg}</p>
              )}
              <div className="pt-3">
                {pool && getPoolStatus(pool) === "open" && (
                  <button
                    onClick={() => {
                      updateReveal("idle");
                      setResultMsg(null);
                      setWonAmount(null);
                      handleBuy();
                    }}
                    className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-500 transition-colors"
                  >
                    Try Again — {lamportsToSol(pool.ticketPrice).toFixed(4)} SOL
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pool info */}
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Prize Pool" value={`${lamportsToSol(pool.prizePool).toFixed(4)} SOL`} />
          <InfoRow
            label="Tickets"
            value={`${pool.totalTickets - pool.ticketLeft} / ${pool.totalTickets} sold`}
          />
          <InfoRow label="Ticket Price" value={`${lamportsToSol(pool.ticketPrice).toFixed(4)} SOL`} />
          <InfoRow label="Creator" value={shortenAddress(pool.creator.toBase58())} mono />
          {pool.winner && (
            <InfoRow label="Winner" value={shortenAddress(pool.winner.toBase58())} mono highlight />
          )}
          {pool.closedAt && (
            <InfoRow
              label="Closed At"
              value={new Date(pool.closedAt.toNumber() * 1000).toLocaleString()}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {canBuy && (
            <button
              onClick={handleBuy}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-500 transition-colors"
            >
              Buy Ticket — {lamportsToSol(pool.ticketPrice).toFixed(4)} SOL
            </button>
          )}

          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-lg border border-red-600 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-600/20 disabled:opacity-50 transition-colors"
            >
              {cancelling ? "Cancelling..." : "Cancel Pool"}
            </button>
          )}

          {!isBusy && (
            <button
              onClick={loadPool}
              className="rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Refresh
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-950/50 border border-red-900 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Pool-specific event feed */}
      <EventFeed events={poolEvents} />
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p
        className={`text-sm ${mono ? "font-mono" : ""} ${
          highlight ? "text-green-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
