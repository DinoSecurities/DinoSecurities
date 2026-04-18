import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PDA_SEEDS, DEFAULT_PROGRAM_IDS } from "./constants.js";

/**
 * PDA derivation helpers for dino_core. Every helper accepts the
 * program ID so consumers can point the same SDK at devnet / mainnet
 * / a local validator without editing the constants.
 *
 * Each returns a [PublicKey, bump] tuple — identical shape to Anchor's
 * native helper output so it plugs straight into an instruction build.
 */

export function derivePlatformPda(
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.PLATFORM)],
    programId,
  );
}

export function deriveIssuerPda(
  authority: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.ISSUER), authority.toBuffer()],
    programId,
  );
}

export function deriveSeriesPda(
  mint: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.SERIES), mint.toBuffer()],
    programId,
  );
}

export function deriveHolderPda(
  mint: PublicKey,
  holder: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.HOLDER), mint.toBuffer(), holder.toBuffer()],
    programId,
  );
}

export function deriveExtraAccountMetaListPda(
  mint: PublicKey,
  hookProgramId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.EXTRA_ACCOUNT_METAS), mint.toBuffer()],
    hookProgramId,
  );
}

export interface DerivedPdasForMint {
  platform: PublicKey;
  series: PublicKey;
  extraAccountMetaList: PublicKey;
  issuer: PublicKey | null;
  holder: PublicKey | null;
  holderAta: PublicKey | null;
}

/**
 * One-shot helper that derives every PDA relevant to a (mint, holder)
 * interaction in a single call — saves consumer code from spelling the
 * same seed vocabulary over and over.
 */
export function derivePdas(args: {
  mint: PublicKey;
  holder?: PublicKey;
  issuer?: PublicKey;
  coreProgramId: PublicKey;
  hookProgramId: PublicKey;
}): DerivedPdasForMint {
  const [platform] = derivePlatformPda(args.coreProgramId);
  const [series] = deriveSeriesPda(args.mint, args.coreProgramId);
  const [extraAccountMetaList] = deriveExtraAccountMetaListPda(
    args.mint,
    args.hookProgramId,
  );
  const issuer = args.issuer
    ? deriveIssuerPda(args.issuer, args.coreProgramId)[0]
    : null;
  const holder = args.holder
    ? deriveHolderPda(args.mint, args.holder, args.coreProgramId)[0]
    : null;
  const holderAta = args.holder
    ? getAssociatedTokenAddressSync(
        args.mint,
        args.holder,
        false,
        DEFAULT_PROGRAM_IDS.TOKEN_2022,
      )
    : null;
  return {
    platform,
    series,
    extraAccountMetaList,
    issuer,
    holder,
    holderAta,
  };
}
