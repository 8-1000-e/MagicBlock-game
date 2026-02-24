"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Program, type Idl } from "@coral-xyz/anchor";
import {
  addEventListener,
  removeEventListener,
  type GameEvent,
  type PoolCreatedEvent,
  type TicketBoughtEvent,
  type TicketResolvedEvent,
  type PoolCancelledEvent,
} from "@/lib/sdk";

const MAX_EVENTS = 50;

export function useEvents(program: Program<Idl> | null) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const listenerIds = useRef<number[]>([]);

  const pushEvent = useCallback((event: GameEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
  }, []);

  useEffect(() => {
    if (!program) return;

    const ids: number[] = [];

    ids.push(
      addEventListener(program, "PoolCreated", (data: PoolCreatedEvent) => {
        pushEvent({ type: "poolCreated", data });
      })
    );

    ids.push(
      addEventListener(program, "TicketBought", (data: TicketBoughtEvent) => {
        pushEvent({ type: "ticketBought", data });
      })
    );

    ids.push(
      addEventListener(program, "TicketResolved", (data: TicketResolvedEvent) => {
        pushEvent({ type: "ticketResolved", data });
      })
    );

    ids.push(
      addEventListener(program, "PoolCancelled", (data: PoolCancelledEvent) => {
        pushEvent({ type: "poolCancelled", data });
      })
    );

    listenerIds.current = ids;

    return () => {
      ids.forEach((id) => removeEventListener(program, id));
      listenerIds.current = [];
    };
  }, [program, pushEvent]);

  return { events };
}
