# Carde Game VRF

On-chain lottery on Solana using [MagicBlock VRF](https://docs.magicblock.gg/) for verifiable randomness.

An admin creates a pool with a prize and N tickets. Players buy tickets — the price doubles after each purchase. Every ticket triggers a VRF draw: probability of winning is `1 / tickets_remaining`. If someone wins, they receive the entire prize pool.

**Devnet only.** Built with Anchor 0.32.1.

## Program

**ID:** `9As38cKdZYeMStQjfDdWgTUKTBLpxb4XUhPd6FtJhtbQ`

### Instructions

| Instruction | Who | What |
|---|---|---|
| `initialize` | super_admin | Creates Config PDA (one-time) |
| `add_admin` | super_admin | Adds an admin |
| `remove_admin` | super_admin | Removes an admin |
| `create_pool` | admin / super_admin | Creates a pool + deposits prize SOL |
| `buy_ticket` | anyone | Buys a ticket, triggers VRF |
| `resolve_ticket` | VRF callback | Resolves the draw (auto, not called manually) |
| `cancel_pool` | pool creator | Cancels if no tickets sold |

### State

```
Config PDA ["config"]
├── super_admin, admins (max 10), pool_count

Pool PDA ["pool", pool_id]
├── creator, prize_pool, ticket_price, total_tickets, ticket_left
├── status: Open | PendingVrf | Settled | Cancelled
├── last_buyer, winner, created_at, closed_at
```

### Events

`PoolCreated`, `TicketBought`, `TicketResolved`, `PoolCancelled` — emitted on every state change.

### VRF flow

1. `buy_ticket` → pool status becomes `PendingVrf`
2. MagicBlock oracle resolves randomness off-chain (~5-30s)
3. `resolve_ticket` callback fires automatically
4. Pool returns to `Open` (lost) or becomes `Settled` (won)

## SDK

TypeScript SDK in `sdk/` — PDA helpers, fetch functions, instruction builders. Ready to use with `@coral-xyz/anchor`.

```typescript
import { createProgram, fetchAllPools, buyTicket, createPool } from "./sdk";
```

## Frontend

Small vibe-coded Next.js app in `app/` to test the game flow. Wallet adapter + Tailwind. Nothing fancy, just enough to interact with the program on devnet.

## Build & Deploy

```bash
anchor build
anchor deploy --provider.cluster devnet
```

## Known limitations

This is a small devnet program, not production-ready. Things that would need to be addressed for a real deployment:

- **VRF timeout recovery** — If the MagicBlock oracle never callbacks, the pool stays in `PendingVrf` forever and funds are locked. A `force_reopen` instruction with a timeout check would fix this.
- **Ticket price escalation** — Price doubles every purchase (`saturating_mul`). With 50 tickets max, the price becomes astronomically high well before all tickets are sold. A `max_ticket_price` cap or pool expiry would help.
- **Super admin transfer** — No way to transfer the `super_admin` role. If the key is lost, the admin system is bricked.
- **Pool rent accumulation** — Settled/Cancelled pools stay on-chain forever (~0.002 SOL each). A `close_pool` instruction would reclaim rent, but we keep them for history.
- **No re-buy protection** — Same wallet can buy all tickets in a pool.
- **Hardcoded devnet constants** — Oracle queue, VRF program addresses are devnet-only.
