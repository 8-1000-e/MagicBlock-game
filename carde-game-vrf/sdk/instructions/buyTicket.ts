import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { CardeGameVrf } from "../../target/types/carde_game_vrf";
import { getPoolPda, getProgramIdentityPda } from "../pda";
import { ORACLE_QUEUE, VRF_PROGRAM, SLOT_HASHES } from "../constants";

export async function buyTicket(
  program: Program<CardeGameVrf>,
  poolId: BN
): Promise<string> {
  const [pool] = getPoolPda(poolId);
  const [programIdentity] = getProgramIdentityPda();
  const provider = program.provider as AnchorProvider;

  return program.methods
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
    .rpc();
}
