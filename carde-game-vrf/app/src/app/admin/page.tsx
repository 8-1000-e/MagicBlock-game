"use client";

import { useState } from "react";
import { useProgram } from "@/hooks/useProgram";
import { useAdmin } from "@/hooks/useAdmin";
import { CreatePoolForm } from "@/components/CreatePoolForm";
import { AdminManager } from "@/components/AdminManager";
import { initialize } from "@/lib/sdk";

export default function AdminPage() {
  const program = useProgram();
  const { config, isAdmin, isSuperAdmin, loading } = useAdmin(program);
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initSuccess, setInitSuccess] = useState(false);

  async function handleInitialize() {
    if (!program) return;
    setInitLoading(true);
    setInitError(null);
    try {
      await initialize(program);
      setInitSuccess(true);
      // Reload to pick up new config
      window.location.reload();
    } catch (err: unknown) {
      setInitError(err instanceof Error ? err.message : "Initialize failed");
    } finally {
      setInitLoading(false);
    }
  }

  if (!program) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-zinc-400">Connect your wallet to access admin panel</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      {/* Initialize button — shown when config doesn't exist */}
      {!config && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Initialize Program</h3>
          <p className="text-sm text-zinc-400">
            The program config has not been created yet. Click below to initialize it.
            Your wallet will become the super admin.
          </p>
          <button
            onClick={handleInitialize}
            disabled={initLoading}
            className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {initLoading ? "Initializing..." : "Initialize"}
          </button>
          {initError && <p className="text-sm text-red-400">{initError}</p>}
          {initSuccess && <p className="text-sm text-green-400">Initialized!</p>}
        </div>
      )}

      {/* Not authorized */}
      {config && !isAdmin && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">
            Your wallet is not authorized. You need to be an admin or super admin.
          </p>
        </div>
      )}

      {/* Create Pool form — for admins */}
      {config && isAdmin && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <CreatePoolForm program={program} />
        </div>
      )}

      {/* Admin management — super admin only */}
      {config && isSuperAdmin && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <AdminManager program={program} config={config} />
        </div>
      )}
    </div>
  );
}
