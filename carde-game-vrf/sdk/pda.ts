import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { PROGRAM_ID, CONFIG_SEED, POOL_SEED, VRF_PROGRAM } from "./constants";

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
    VRF_PROGRAM
  );
}
