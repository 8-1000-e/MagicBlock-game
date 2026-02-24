import { Program, BN } from "@coral-xyz/anchor";
import { CardeGameVrf } from "../target/types/carde_game_vrf";
import { getConfigPda, getPoolPda } from "./pda";

export async function fetchConfig(program: Program<CardeGameVrf>) {
  const [config] = getConfigPda();
  return program.account.config.fetch(config);
}

export async function fetchPool(program: Program<CardeGameVrf>, poolId: BN) {
  const [pool] = getPoolPda(poolId);
  return program.account.pool.fetch(pool);
}

export async function fetchAllPools(program: Program<CardeGameVrf>) {
  return program.account.pool.all();
}
