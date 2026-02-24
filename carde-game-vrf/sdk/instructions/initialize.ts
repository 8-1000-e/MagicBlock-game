import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { CardeGameVrf } from "../../target/types/carde_game_vrf";
import { getConfigPda } from "../pda";

export async function initialize(program: Program<CardeGameVrf>): Promise<string> {
  const [config] = getConfigPda();
  const provider = program.provider as AnchorProvider;

  return program.methods
    .initialize()
    .accounts({
      superAdmin: provider.wallet.publicKey,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}
