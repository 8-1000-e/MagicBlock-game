"use client";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-500/20 text-green-400 border-green-500/30",
  pendingVrf: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  settled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cancelled: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  pendingVrf: "Pending VRF",
  settled: "Settled",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] || STATUS_STYLES.cancelled
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
