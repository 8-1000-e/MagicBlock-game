import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { CardeGameVrf } from "../target/types/carde_game_vrf";
import IDL from "../target/idl/carde_game_vrf.json";

export function createProgram(provider: AnchorProvider): Program<CardeGameVrf> {
  return new Program(IDL as CardeGameVrf, provider);
}
