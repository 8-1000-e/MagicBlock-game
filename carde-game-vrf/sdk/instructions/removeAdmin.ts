import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { CardeGameVrf } from "../../target/types/carde_game_vrf";
import { getConfigPda } from "../pda";

export async function removeAdmin(
  program: Program<CardeGameVrf>,
  admin: PublicKey
): Promise<string> {
  const [config] = getConfigPda();
  const provider = program.provider as AnchorProvider;

  return program.methods
    .removeAdmin(admin)
    .accounts({
      superAdmin: provider.wallet.publicKey,
      config,
    })
    .rpc();
}
