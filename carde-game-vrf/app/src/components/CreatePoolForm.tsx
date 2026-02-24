"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Program, type Idl } from "@coral-xyz/anchor";
import { createPool, fetchConfig } from "@/lib/sdk";
import { solToLamports } from "@/lib/utils";

export function CreatePoolForm({
  program,
  onCreated,
}: {
  program: Program<Idl>;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [prize, setPrize] = useState("0.1");
  const [price, setPrice] = useState("0.01");
  const [tickets, setTickets] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Fetch poolCount before creation — this will be the new pool's ID
      const config = await fetchConfig(program);
      const newPoolId = config.poolCount.toNumber();

      await createPool(
        program,
        solToLamports(parseFloat(prize)),
        solToLamports(parseFloat(price)),
        parseInt(tickets)
      );

      onCreated?.();
      router.push(`/pool/${newPoolId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Create Pool</h3>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Prize Pool (SOL)</label>
        <input
          type="number"
          step="0.001"
          min="0.001"
          value={prize}
          onChange={(e) => setPrize(e.target.value)}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Ticket Price (SOL)</label>
        <input
          type="number"
          step="0.001"
          min="0.001"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Total Tickets (1-50)</label>
        <input
          type="number"
          min="1"
          max="50"
          value={tickets}
          onChange={(e) => setTickets(e.target.value)}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Creating..." : "Create Pool"}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
