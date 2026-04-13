/**
 * dino_governance smoke tests.
 *
 * Realm creation requires a real Token-2022 mint account (validated by
 * Anchor's InterfaceAccount<Mint>). Full vote-lifecycle tests are deferred
 * to the Token-2022 integration suite. For now we verify the program is
 * deployed and the IDL exposes the expected instruction surface.
 */
import * as anchor from "@coral-xyz/anchor";
import BNDefault from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";

const Program = anchor.Program;
const BN = (anchor as any).BN ?? BNDefault;

const IDL_PATH = path.resolve(process.cwd(), "target/idl/dino_governance.json");
const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));

describe("dino_governance", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program(idl as any, provider);
  const programId: PublicKey = program.programId;

  it("the program is deployed at the configured address", async () => {
    const info = await provider.connection.getAccountInfo(programId);
    expect(info).to.not.equal(null);
    expect(info!.executable).to.equal(true);
  });

  it("IDL exposes the expected instruction surface", () => {
    const ixNames = (idl.instructions ?? []).map((i: any) => i.name).sort();
    expect(ixNames).to.include.members([
      "cast_vote",
      "create_proposal",
      "create_realm",
      "execute_proposal",
      "finalize_proposal",
    ]);
  });

  it("IDL exposes the expected account types", () => {
    const accountNames = (idl.accounts ?? []).map((a: any) => a.name).sort();
    expect(accountNames).to.include.members(["Proposal", "Realm", "VoteRecord"]);
  });

  it("IDL exposes proposal types covering the spec lifecycle", () => {
    const proposalType = (idl.types ?? []).find((t: any) => t.name === "ProposalType");
    expect(proposalType).to.not.equal(undefined);
    const variants = (proposalType?.type?.variants ?? []).map((v: any) => v.name).sort();
    expect(variants).to.include.members([
      "BurnTokens",
      "EmergencyPause",
      "FreezeHolder",
      "MintAdditional",
      "TreasuryTransfer",
      "UpdateLegalDoc",
      "UpdateTransferRestrictions",
      "UpgradeProgram",
    ]);
  });
});
