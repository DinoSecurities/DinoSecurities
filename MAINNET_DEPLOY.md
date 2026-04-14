# Mainnet Deployment Guide

> Start → production on Solana mainnet-beta. Work through each phase in order; do not skip steps marked 🔒 (security-critical).

## Phase 1 — Keys & funding

Generate **four dedicated mainnet keypairs** on an air-gapped or at least fresh machine. Never reuse devnet keys on mainnet.

```bash
# Deployer — signs program deploys + upgrade authority transfers
solana-keygen new --outfile ~/.config/solana/dinosecurities-deployer-mainnet.json

# KYC Oracle — co-signs register_holder, kept separate so compromising one
# of the other keys doesn't also let the attacker whitelist sybils
solana-keygen new --outfile ~/.config/solana/dinosecurities-oracle-mainnet.json

# Settlement Agent — signs DvP execute_settlement transactions
solana-keygen new --outfile ~/.config/solana/dinosecurities-settlement-mainnet.json

# Irys — pays for Arweave uploads; funded with SOL that goes purely to
# storage
solana-keygen new --outfile ~/.config/solana/dinosecurities-irys-mainnet.json
```

🔒 **Back up every seed phrase to a password manager AND a physical safe.** Test restore from each before relying on the original.

Fund the deployer with **≥ 15 SOL** (program deploys consume ~8-12 depending on size, plus a buffer for upgrades). The other three need < 1 SOL each for tx fees; the Irys wallet needs 2-5 SOL depending on expected doc volume.

## Phase 2 — Multisig 🔒

Create a Squads V4 multisig at https://v4.squads.so with **≥ 2-of-3** or **≥ 3-of-5** signers. Do this **before** deploying — you'll hand the upgrade authority to the multisig immediately after deploy so the single deployer key never becomes a standing single point of failure.

Record the multisig pubkey; export as `MULTISIG_PUBKEY` in your shell when running Phase 4.

## Phase 3 — Deploy

```bash
cd programs
solana config set --url mainnet-beta
solana config set --keypair ~/.config/solana/dinosecurities-deployer-mainnet.json
bash scripts/deploy-mainnet.sh
```

The script prints the three program IDs. Paste them into:

- [programs/Anchor.toml](programs/Anchor.toml) under `[programs.mainnet]`
- Each program's `declare_id!` in `programs/programs/*/src/lib.rs`

Rebuild and redeploy once more so the declared ID matches the deployed address (standard Anchor procedure for fresh deploys):

```bash
cargo-build-sbf --tools-version v1.54 -- -p dino_core
cargo-build-sbf --tools-version v1.54 -- -p dino_transfer_hook
cargo-build-sbf --tools-version v1.54 -- -p dino_governance
bash scripts/deploy-mainnet.sh   # idempotent upgrade path
```

## Phase 4 — Transfer upgrade authority 🔒

```bash
MULTISIG_PUBKEY=<your-squads-pubkey> \
DEPLOYER_KEYPAIR=~/.config/solana/dinosecurities-deployer-mainnet.json \
bash scripts/transfer-upgrade-authority.sh
```

Verify with `solana program show <program-id>` — the Authority field should be your multisig. From this point only the multisig can upgrade the programs.

## Phase 5 — Initialize platform

With the mainnet program IDs set, run:

```bash
ANCHOR_PROVIDER_URL=https://api.mainnet-beta.solana.com \
ANCHOR_WALLET=~/.config/solana/dinosecurities-deployer-mainnet.json \
npx ts-node --transpile-only --compiler-options \
  '{"module":"commonjs","esModuleInterop":true,"resolveJsonModule":true}' \
  scripts/init-platform.ts
```

Edit the script first to point `SETTLEMENT_KEY` and `kycOracle` at the **dedicated mainnet keypairs from Phase 1**, not the deployer.

## Phase 6 — Environment variables

### Backend (DigitalOcean App Platform)

Replace every devnet value with mainnet equivalents:

| Key | Mainnet value |
| --- | --- |
| `DATABASE_URL` | Supabase production project pooler URL |
| `SOLANA_RPC_URL` | Helius mainnet (paid plan — never use free tier) |
| `SOLANA_RPC_FALLBACK` | QuickNode or Triton mainnet endpoint |
| `DINO_CORE_PROGRAM_ID` | from Phase 3 |
| `DINO_HOOK_PROGRAM_ID` | from Phase 3 |
| `DINO_GOV_PROGRAM_ID` | from Phase 3 |
| `HELIUS_API_KEY` | paid-plan key |
| `WEBHOOK_SECRET` | **rotate** — new `openssl rand -hex 32` |
| `KYC_PROVIDER_API_KEY` | Didit production key (swap from sandbox) |
| `KYC_WEBHOOK_SECRET` | Didit production webhook secret |
| `SETTLEMENT_AGENT_KEY` | contents of mainnet settlement keypair |
| `IRYS_WALLET_KEY` | contents of mainnet Irys keypair |
| `PINATA_API_KEY` / `PINATA_SECRET_KEY` | production Pinata keys |
| `CORS_ORIGIN` | `https://www.dinosecurities.com,https://dinosecurities.com` |
| `ADMIN_WALLETS` | the mainnet admin wallet (may differ from deployer) |

### Frontend (Vercel)

| Key | Mainnet value |
| --- | --- |
| `VITE_SOLANA_NETWORK` | `mainnet-beta` |
| `VITE_SOLANA_RPC_URL` | Helius mainnet URL |
| `VITE_DINO_CORE_PROGRAM_ID` / `VITE_DINO_HOOK_PROGRAM_ID` / `VITE_DINO_GOV_PROGRAM_ID` | from Phase 3 |
| `VITE_USDC_MINT` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (mainnet USDC) |
| `VITE_API_URL` | DO backend URL + `/trpc` |

Trigger a redeploy on both after updating env.

## Phase 7 — Helius webhook

Re-create the enhanced webhook at https://dashboard.helius.dev/webhooks pointing at `https://<backend>/webhooks/helius`, with the mainnet program IDs in the account-addresses list and the **new** `WEBHOOK_SECRET` as the Auth Header.

## Phase 8 — Final checks before announcing

- [ ] Deploy a throwaway test series on mainnet, mint 1 token, cancel, verify everything works
- [ ] Confirm upgrade authority is the multisig (`solana program show`)
- [ ] Confirm the deployer wallet has no standing authority — it's just funding
- [ ] `/admin/run-matching` works and logs clean ticks
- [ ] Helius webhook fires and `webhook_events` row appears
- [ ] KYC webhook signature-rejects a spoofed POST (401)
- [ ] Frontend build passes `npm run build` with no warnings you haven't reviewed

## Phase 9 — Incident response

Have a runbook written and tested **before** the first real investor:

- Who holds which multisig key?
- What's the SLA to rotate a leaked secret?
- Where is the monitoring dashboard?
- Where are upgrade-PRs reviewed and signed?
- Who can call `emergency_pause` on each series?

If any of those doesn't have a clear answer, you're not ready for mainnet.

---

## Required before real issuance

These aren't flipped-a-bit-in-config items. Do them **in parallel** with the above.

- **Smart contract audit** — reputable firm (OtterSec, Trail of Bits, Halborn). Budget $30–100k and 4–8 weeks. Fix every finding above Low.
- **Legal review** — securities counsel reviews the Ricardian contract template, Reg D/S/CF/A+ compliance flow, KYC oracle data handling, custody arrangements.
- **Insurance** — cyber liability + D&O at minimum.
- **Compliance operating agreement** with the KYC provider (Didit).
- **Broker-dealer or ATS partnership** if you intend to facilitate secondary trading in the US under the platform's branding.
