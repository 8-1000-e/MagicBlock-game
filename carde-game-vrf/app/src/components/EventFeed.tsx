"use client";

import type { GameEvent } from "@/lib/sdk";
import { lamportsToSol, shortenAddress } from "@/lib/utils";

function formatEvent(event: GameEvent): { icon: string; text: string; color: string } {
  switch (event.type) {
    case "poolCreated":
      return {
        icon: "+",
        text: `Pool #${event.data.poolId.toString()} created — ${lamportsToSol(event.data.prizePool).toFixed(4)} SOL prize`,
        color: "text-blue-400",
      };
    case "ticketBought":
      return {
        icon: "$",
        text: `${shortenAddress(event.data.buyer.toBase58())} bought ticket on Pool #${event.data.poolId.toString()} for ${lamportsToSol(event.data.pricePaid).toFixed(4)} SOL`,
        color: "text-yellow-400",
      };
    case "ticketResolved":
      if (event.data.won) {
        return {
          icon: "!",
          text: `${shortenAddress(event.data.buyer.toBase58())} WON ${lamportsToSol(event.data.prize).toFixed(4)} SOL on Pool #${event.data.poolId.toString()}!`,
          color: "text-green-400",
        };
      }
      return {
        icon: "x",
        text: `${shortenAddress(event.data.buyer.toBase58())} lost on Pool #${event.data.poolId.toString()}`,
        color: "text-zinc-400",
      };
    case "poolCancelled":
      return {
        icon: "-",
        text: `Pool #${event.data.poolId.toString()} cancelled — ${lamportsToSol(event.data.refunded).toFixed(4)} SOL refunded`,
        color: "text-zinc-500",
      };
  }
}

export function EventFeed({ events }: { events: GameEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Live Feed</h3>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {events.map((event, i) => {
          const { icon, text, color } = formatEvent(event);
          return (
            <div key={i} className={`text-xs ${color} flex gap-2`}>
              <span className="font-mono w-3 text-center">{icon}</span>
              <span>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
