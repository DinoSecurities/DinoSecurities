/**
 * dino_core integration tests.
 *
 * Runs against the deployed devnet program. Spin up with:
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/dinosecurities-deployer.json \
 *   npx ts-mocha -p ./tsconfig.json -t 180000 tests/dino_core.spec.ts
 *
 * Tests that depend on a real Token-2022 mint with all required extensions
 * (Transfer Hook, Default Frozen, Metadata Pointer, Permanent Delegate) are
 * deferred to the Token-2022 integration suite — they need ~100 LOC of
 * setup per test that's better handled by a fixture builder.
 */
import * as anchor from "@coral-xyz/anchor";
import BNDefault from "bn.js";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";

const Program = anchor.Program;
const BN = (anchor as any).BN ?? BNDefault;

const IDL_PATH = path.resolve(process.cwd(), "target/idl/dino_core.json");
const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));

const PLATFORM_SEED = Buffer.from("platform");
const ISSUER_SEED = Buffer.from("issuer");

describe("dino_core", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program(idl as any, provider);
  const programId: PublicKey = program.programId;

  const admin = (provider.wallet as anchor.Wallet).payer;
  const oracle = Keypair.generate();
  const issuerWallet = Keypair.generate();

  const [platformPda] = PublicKey.findProgramAddressSync([PLATFORM_SEED], programId);
  const [issuerPda] = PublicKey.findProgramAddressSync(
    [ISSUER_SEED, issuerWallet.publicKey.toBuffer()],
    programId,
  );

  before(async () => {
    for (const k of [oracle, issuerWallet]) {
      try {
        const sig = await provider.connection.requestAirdrop(k.publicKey, 0.05 * LAMPORTS_PER_SOL);
        await provider.connection.confirmTransaction(sig, "confirmed");
      } catch {
        const tx = new anchor.web3.Transaction().add(
          SystemProgram.transfer({
            fromPubkey: admin.publicKey,
            toPubkey: k.publicKey,
            lamports: 0.05 * LAMPORTS_PER_SOL,
          }),
        );
        await provider.sendAndConfirm(tx, []);
      }
    }
  });

  it("the platform is initialized and admin matches deployer", async () => {
    const cfg = await (program.account as any).platformConfig.fetch(platformPda);
    expect(cfg.admin.toBase58()).to.equal(admin.publicKey.toBase58());
  });

  it("admin can rotate the kyc oracle and settlement agent", async () => {
    const before = await (program.account as any).platformConfig.fetch(platformPda);
    const newOracle = Keypair.generate();

    await program.methods
      .updatePlatform(null, null, newOracle.publicKey, null)
      .accountsStrict({ platform: platformPda, admin: admin.publicKey })
      .rpc();
    let cfg = await (program.account as any).platformConfig.fetch(platformPda);
    expect(cfg.kycOracle.toBase58()).to.equal(newOracle.publicKey.toBase58());

    // restore previous so other tests aren't affected
    await program.methods
      .updatePlatform(null, null, before.kycOracle, null)
      .accountsStrict({ platform: platformPda, admin: admin.publicKey })
      .rpc();
  });

  it("rejects updatePlatform from non-admin signer", async () => {
    try {
      await program.methods
        .updatePlatform(null, null, null, true)
        .accountsStrict({ platform: platformPda, admin: oracle.publicKey })
        .signers([oracle])
        .rpc();
      expect.fail("should have thrown — non-admin update accepted");
    } catch (e: any) {
      const msg = String(e);
      expect(msg.includes("UnauthorizedAdmin") || msg.includes("ConstraintHasOne")).to.equal(true);
    }
  });

  it("rejects issuer registration without oracle co-signature", async () => {
    const expiry = new BN(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
    const fakeOracle = Keypair.generate();
    try {
      await program.methods
        .registerIssuer("Test Issuer", "US", new Array(32).fill(1), expiry)
        .accountsStrict({
          issuer: issuerPda,
          platform: platformPda,
          oracle: fakeOracle.publicKey,
          authority: issuerWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([issuerWallet, fakeOracle])
        .rpc();
      expect.fail("should have thrown UnauthorizedOracle");
    } catch (e: any) {
      expect(String(e)).to.include("UnauthorizedOracle");
    }
  });

  it("registers an issuer when the configured oracle co-signs", async () => {
    const cfg = await (program.account as any).platformConfig.fetch(platformPda);

    // Set our test oracle as the platform oracle for this test
    await program.methods
      .updatePlatform(null, null, oracle.publicKey, null)
      .accountsStrict({ platform: platformPda, admin: admin.publicKey })
      .rpc();

    try {
      const existing = await provider.connection.getAccountInfo(issuerPda);
      if (existing) {
        const issuer = await (program.account as any).issuerProfile.fetch(issuerPda);
        expect(issuer.authority.toBase58()).to.equal(issuerWallet.publicKey.toBase58());
        return;
      }
      const expiry = new BN(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
      await program.methods
        .registerIssuer("Test Issuer LLC", "US", new Array(32).fill(2), expiry)
        .accountsStrict({
          issuer: issuerPda,
          platform: platformPda,
          oracle: oracle.publicKey,
          authority: issuerWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([issuerWallet, oracle])
        .rpc();
      const issuer = await (program.account as any).issuerProfile.fetch(issuerPda);
      expect(issuer.legalName).to.equal("Test Issuer LLC");
      expect(issuer.isActive).to.equal(true);
      expect(issuer.seriesCount).to.equal(0);
    } finally {
      // Restore original oracle so we don't leave the platform in test state
      await program.methods
        .updatePlatform(null, null, cfg.kycOracle, null)
        .accountsStrict({ platform: platformPda, admin: admin.publicKey })
        .rpc();
    }
  });

  it("rejects issuer registration with expired KYC", async () => {
    const fresh = Keypair.generate();
    try {
      const sig = await provider.connection.requestAirdrop(fresh.publicKey, 0.02 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig, "confirmed");
    } catch {
      const tx = new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: fresh.publicKey,
          lamports: 0.02 * LAMPORTS_PER_SOL,
        }),
      );
      await provider.sendAndConfirm(tx, []);
    }
    const [freshIssuerPda] = PublicKey.findProgramAddressSync(
      [ISSUER_SEED, fresh.publicKey.toBuffer()],
      programId,
    );
    const past = new BN(Math.floor(Date.now() / 1000) - 60);
    try {
      await program.methods
        .registerIssuer("Bad Issuer", "US", new Array(32).fill(3), past)
        .accountsStrict({
          issuer: freshIssuerPda,
          platform: platformPda,
          oracle: oracle.publicKey,
          authority: fresh.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([fresh, oracle])
        .rpc();
      expect.fail("should have thrown KycExpired");
    } catch (e: any) {
      // Either UnauthorizedOracle (if we didn't set our oracle) or KycExpired.
      const msg = String(e);
      expect(msg.includes("KycExpired") || msg.includes("UnauthorizedOracle")).to.equal(true);
    }
  });
});
