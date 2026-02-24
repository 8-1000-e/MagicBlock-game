"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Program, type Idl } from "@coral-xyz/anchor";
import { addAdmin, removeAdmin, type ConfigAccount } from "@/lib/sdk";
import { shortenAddress } from "@/lib/utils";

export function AdminManager({
  program,
  config,
}: {
  program: Program<Idl>;
  config: ConfigAccount;
}) {
  const [pubkey, setPubkey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleAdd() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const pk = new PublicKey(pubkey);
      await addAdmin(program, pk);
      setSuccess(`Added ${shortenAddress(pubkey)}`);
      setPubkey("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add admin");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(admin: PublicKey) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await removeAdmin(program, admin);
      setSuccess(`Removed ${shortenAddress(admin.toBase58())}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove admin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Manage Admins</h3>

      <div className="space-y-2">
        <p className="text-sm text-zinc-400">
          Super Admin: <span className="font-mono text-zinc-300">{shortenAddress(config.superAdmin.toBase58())}</span>
        </p>
        <p className="text-sm text-zinc-400">Current admins ({config.admins.length}):</p>
        {config.admins.length === 0 ? (
          <p className="text-sm text-zinc-600 italic">No admins yet</p>
        ) : (
          <ul className="space-y-1">
            {config.admins.map((a) => (
              <li key={a.toBase58()} className="flex items-center justify-between text-sm">
                <span className="font-mono text-zinc-300">{shortenAddress(a.toBase58(), 8)}</span>
                <button
                  onClick={() => handleRemove(a)}
                  disabled={loading}
                  className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Admin public key"
          value={pubkey}
          onChange={(e) => setPubkey(e.target.value)}
          className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={loading || !pubkey}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-400">{success}</p>}
    </div>
  );
}
