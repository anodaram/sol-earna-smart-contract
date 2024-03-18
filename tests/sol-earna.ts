import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolEarna } from "../target/types/sol_earna";
import { Wrapper } from "../target/types/wrapper";

describe("sol-earna", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const solEarna = anchor.workspace.SolEarna as Program<SolEarna>;
  const wrapper = anchor.workspace.Wrapper as Program<Wrapper>;

  it("Is initialized!", async () => {
  });
});
