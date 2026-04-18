# @dinosecurities/sdk

TypeScript SDK for [DinoSecurities](https://www.dinosecurities.com/) — Solana-native regulated securities. The shortest path from `npm install` to shipping an integration.

## Install

```bash
npm install @dinosecurities/sdk @coral-xyz/anchor @solana/web3.js
```

`@coral-xyz/anchor` and `@solana/web3.js` are peer dependencies so you control their version.

## What's in the box

- **PDA derivation** — every `dino_core` / `dino_transfer_hook` PDA in one helper call.
- **Instruction builders** — pass what you mean, not the full account-resolution ceremony.
- **Typed tRPC client factory** — pre-configured to hit the production backend.
- **REST helper** for `/api/v1/compliance/simulate`.
- **Bundled IDLs** for all three Anchor programs (`dino_core`, `dino_transfer_hook`, `dino_governance`).
- **Ricardian doc-hash verifier** for SHA-256 integrity checks.

Ships ESM + CJS + type declarations. Anchor and `@solana/web3.js` are peer deps so the SDK stays small and version-aligned.

## Quick start

### List every security on the platform

```ts
import { createDinoClient } from "@dinosecurities/sdk";

const dino = createDinoClient();
const { items } = await dino.securities.list.query({ page: 1, limit: 20 });
for (const s of items) {
  console.log(s.symbol, s.name, s.mintAddress);
}
```

### Simulate a Transfer Hook check off-chain

```ts
import { simulateCompliance } from "@dinosecurities/sdk";

const result = await simulateCompliance({
  wallet: "…",
  mint: "…",
});

console.log(result.overall); // "pass" | "fail"
for (const c of result.checks) console.log(c.status, c.name);
```

### Derive every PDA for a (mint, holder) interaction

```ts
import { derivePdas } from "@dinosecurities/sdk";
import { PublicKey } from "@solana/web3.js";

const pdas = derivePdas({
  mint: new PublicKey("…"),
  holder: new PublicKey("…"),
  coreProgramId: new PublicKey("…"),
  hookProgramId: new PublicKey("…"),
});

console.log(pdas.series.toBase58());
console.log(pdas.holder?.toBase58());
console.log(pdas.holderAta?.toBase58());
```

### Build a `register_holder` instruction

```ts
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import {
  buildRegisterHolderIx,
  makeDinoCoreProgram,
  sha256Hex,
} from "@dinosecurities/sdk";

const provider = new anchor.AnchorProvider(
  new Connection("https://api.mainnet-beta.solana.com"),
  /* wallet adapter or NodeWallet */ wallet,
  { commitment: "confirmed" },
);
const program = makeDinoCoreProgram(provider);

const kycHashHex = await sha256Hex(
  new TextEncoder().encode(`holder:${holder.toBase58()}:${mint.toBase58()}`),
);
const ix = await buildRegisterHolderIx({
  program,
  mint,
  holder,
  oracle,
  kycHash: Uint8Array.from(Buffer.from(kycHashHex, "hex")),
  isAccredited: true,
  jurisdiction: "US",
});
// The caller signs + submits; the platform's oracle co-signs via its backend.
```

## Subpath imports

For small consumers who only want a slice:

```ts
import { derivePdas } from "@dinosecurities/sdk/pdas";
import { simulateCompliance } from "@dinosecurities/sdk/compliance";
import { dinoCoreIdl } from "@dinosecurities/sdk/idl";
```

Each subpath is independently tree-shakeable.

## Environment targets

The `apiBase` defaults to `https://api.dinosecurities.com`. Override to point at staging or a local backend:

```ts
const dino = createDinoClient({ apiBase: "http://localhost:3001" });
```

## Typed tRPC client

Without a router type, you still get runtime correctness. For full autocomplete, pass the `AppRouter` type:

```ts
import type { AppRouter } from "…"; // see: future @dinosecurities/api-types

const dino = createDinoClient<AppRouter>();
await dino.securities.list.query({ page: 1, limit: 20 }); // fully typed
```

A dedicated `@dinosecurities/api-types` package is planned; for now, type-only consumers can import directly from the backend repo.

## Version compatibility

The SDK version is tied to the deployed program version. Major bumps in `@dinosecurities/sdk` line up with Anchor program redeploys — pin the SDK to the environment you're integrating against.

| SDK          | Programs       |
| ------------ | -------------- |
| `0.1.x`      | `dino_core@*`  |

## License

Apache-2.0.
