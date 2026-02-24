import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { CardeGameVrf } from "../../target/types/carde_game_vrf";
import { getConfigPda, getPoolPda } from "../pda";

export async function createPool(
  program: Program<CardeGameVrf>,
  prizePool: BN,
  ticketPrice: BN,
  totalTickets: number
): Promise<string> {
  const [config] = getConfigPda();
  const configAccount = await program.account.config.fetch(config);
  const [pool] = getPoolPda(configAccount.poolCount);
  const provider = program.provider as AnchorProvider;

  return program.methods
    .createPool(prizePool, ticketPrice, totalTickets)
    .accounts({
      creator: provider.wallet.publicKey,
      pool,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}
