import { Program, AnchorProvider, BN, type Idl } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import IDL from "./idl.json";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CardeGameVrf = Idl;

export type PoolAccount = {
  creator: PublicKey;
  poolId: BN;
  prizePool: BN;
  totalTickets: number;
  ticketLeft: number;
  ticketPrice: BN;
  status: { open: {} } | { pendingVrf: {} } | { settled: {} } | { cancelled: {} };
  lastBuyer: PublicKey;
  winner: PublicKey | null;
  bump: number;
  createdAt: BN;
  closedAt: BN | null;
};

export type ConfigAccount = {
  superAdmin: PublicKey;
  admins: PublicKey[];
  poolCount: BN;
  bump: number;
};

// ─── Constants ──────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey("9As38cKdZYeMStQjfDdWgTUKTBLpxb4XUhPd6FtJhtbQ");
export const CONFIG_SEED = Buffer.from("config");
export const POOL_SEED = Buffer.from("pool");
export const ORACLE_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");
export const VRF_PROGRAM = new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
export const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");

// ─── PDA Helpers ────────────────────────────────────────────────────────────

export function getConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
}

export function getPoolPda(poolId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POOL_SEED, poolId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

export function getProgramIdentityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("identity")],
    PROGRAM_ID
  );
}

// ─── Program Factory ────────────────────────────────────────────────────────

export function createProgram(provider: AnchorProvider): Program<Idl> {
  return new Program(IDL as Idl, provider);
}

// ─── Fetch Helpers ──────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchConfig(program: Program<Idl>): Promise<ConfigAccount> {
  const [config] = getConfigPda();
  return (program.account as any).config.fetch(config) as Promise<ConfigAccount>;
}

export async function fetchPool(program: Program<Idl>, poolId: BN): Promise<PoolAccount> {
  const [pool] = getPoolPda(poolId);
  return (program.account as any).pool.fetch(pool) as Promise<PoolAccount>;
}

export async function fetchAllPools(program: Program<Idl>) {
  return (program.account as any).pool.all();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Instructions ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProgram = any;

export async function initialize(program: Program<Idl>): Promise<string> {
  const [config] = getConfigPda();
  const provider = program.provider as AnchorProvider;

  return (program as AnyProgram).methods
    .initialize()
    .accounts({
      superAdmin: provider.wallet.publicKey,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function addAdmin(program: Program<Idl>, newAdmin: PublicKey): Promise<string> {
  const [config] = getConfigPda();
  const provider = program.provider as AnchorProvider;

  return (program as AnyProgram).methods
    .addAdmin(newAdmin)
    .accounts({
      superAdmin: provider.wallet.publicKey,
      config,
    })
    .rpc();
}

export async function removeAdmin(program: Program<Idl>, admin: PublicKey): Promise<string> {
  const [config] = getConfigPda();
  const provider = program.provider as AnchorProvider;

  return (program as AnyProgram).methods
    .removeAdmin(admin)
    .accounts({
      superAdmin: provider.wallet.publicKey,
      config,
    })
    .rpc();
}

export async function createPool(
  program: Program<Idl>,
  prizePool: BN,
  ticketPrice: BN,
  totalTickets: number
): Promise<string> {
  const [config] = getConfigPda();
  const configAccount = await (program.account as AnyProgram).config.fetch(config);
  const poolCount = (configAccount as unknown as ConfigAccount).poolCount;
  const [pool] = getPoolPda(poolCount);
  const provider = program.provider as AnchorProvider;

  return (program as AnyProgram).methods
    .createPool(prizePool, ticketPrice, totalTickets)
    .accounts({
      creator: provider.wallet.publicKey,
      pool,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function buyTicket(program: Program<Idl>, poolId: BN): Promise<string> {
  const [pool] = getPoolPda(poolId);
  const [programIdentity] = getProgramIdentityPda();
  const provider = program.provider as AnchorProvider;

  return (program as AnyProgram).methods
    .buyTicket()
    .accounts({
      buyer: provider.wallet.publicKey,
      pool,
      oracleQueue: ORACLE_QUEUE,
      systemProgram: SystemProgram.programId,
      programIdentity,
      vrfProgram: VRF_PROGRAM,
      slotHashes: SLOT_HASHES,
    })
    .rpc({ skipPreflight: true });
}

export async function cancelPool(program: Program<Idl>, poolId: BN): Promise<string> {
  const [pool] = getPoolPda(poolId);
  const provider = program.provider as AnchorProvider;

  return (program as AnyProgram).methods
    .cancelPool()
    .accounts({
      creator: provider.wallet.publicKey,
      pool,
    })
    .rpc();
}

// ─── Status Helpers ─────────────────────────────────────────────────────────

export function getPoolStatus(pool: PoolAccount): "open" | "pendingVrf" | "settled" | "cancelled" {
  if ("open" in pool.status) return "open";
  if ("pendingVrf" in pool.status) return "pendingVrf";
  if ("settled" in pool.status) return "settled";
  return "cancelled";
}

// ─── Event Types ────────────────────────────────────────────────────────────

export type PoolCreatedEvent = {
  poolId: BN;
  creator: PublicKey;
  prizePool: BN;
  ticketPrice: BN;
  totalTickets: number;
};

export type TicketBoughtEvent = {
  poolId: BN;
  buyer: PublicKey;
  pricePaid: BN;
  ticketsLeft: number;
};

export type TicketResolvedEvent = {
  poolId: BN;
  buyer: PublicKey;
  won: boolean;
  prize: BN;
};

export type PoolCancelledEvent = {
  poolId: BN;
  creator: PublicKey;
  refunded: BN;
};

export type GameEvent =
  | { type: "poolCreated"; data: PoolCreatedEvent }
  | { type: "ticketBought"; data: TicketBoughtEvent }
  | { type: "ticketResolved"; data: TicketResolvedEvent }
  | { type: "poolCancelled"; data: PoolCancelledEvent };

// ─── Event Listener Helpers ─────────────────────────────────────────────────

export function addEventListener(
  program: Program<Idl>,
  eventName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (event: any, slot: number) => void
): number {
  return (program as AnyProgram).addEventListener(eventName, callback);
}

export async function removeEventListener(
  program: Program<Idl>,
  listenerId: number
): Promise<void> {
  await (program as AnyProgram).removeEventListener(listenerId);
}
