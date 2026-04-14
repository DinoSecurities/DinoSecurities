#!/usr/bin/env bash
# Deploy the three DinoSecurities programs to Solana mainnet-beta.
#
# Prerequisites:
#   1. Run programs/scripts/prepare-mainnet-keys.md (checklist) so you have
#      a dedicated mainnet deployer + oracle + settlement agent + Irys key.
#   2. Mainnet deployer wallet funded with ~15 SOL.
#   3. anchor-cli 0.32.1, solana-cli installed, cargo-build-sbf working.
#
# Usage:
#   cd programs
#   bash scripts/deploy-mainnet.sh
#
# The script refuses to run if cluster != mainnet-beta in solana config,
# to avoid accidental devnet overrides.
set -euo pipefail

EXPECTED_WALLET="${MAINNET_DEPLOYER_WALLET:-$HOME/.config/solana/dinosecurities-deployer-mainnet.json}"
ANCHOR_TOML="$(dirname "$0")/../Anchor.toml"

echo "› verifying Solana CLI cluster"
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
if [[ "$CLUSTER" != *"mainnet"* ]]; then
  echo "✗ solana config points at $CLUSTER — expected mainnet-beta"
  echo "  run: solana config set --url mainnet-beta"
  exit 1
fi

echo "› verifying deployer keypair at $EXPECTED_WALLET"
if [[ ! -f "$EXPECTED_WALLET" ]]; then
  echo "✗ keypair not found. See scripts/prepare-mainnet-keys.md"
  exit 1
fi

PUBKEY=$(solana-keygen pubkey "$EXPECTED_WALLET")
BALANCE=$(solana balance "$PUBKEY" | awk '{print $1}')
echo "  deployer: $PUBKEY"
echo "  balance:  $BALANCE SOL"

# Rough minimum — three programs cost ~8-12 SOL depending on size.
NEEDED=10
if (( $(echo "$BALANCE < $NEEDED" | bc -l) )); then
  echo "✗ insufficient SOL (need >= $NEEDED, have $BALANCE)"
  exit 1
fi

echo "› building programs (release)"
cd "$(dirname "$0")/.."
cargo-build-sbf --tools-version v1.54 -- -p dino_core
cargo-build-sbf --tools-version v1.54 -- -p dino_transfer_hook
cargo-build-sbf --tools-version v1.54 -- -p dino_governance

echo "› deploying dino_core"
solana program deploy \
  --keypair "$EXPECTED_WALLET" \
  --program-id target/deploy/dino_core-keypair.json \
  target/deploy/dino_core.so

echo "› deploying dino_transfer_hook"
solana program deploy \
  --keypair "$EXPECTED_WALLET" \
  --program-id target/deploy/dino_transfer_hook-keypair.json \
  target/deploy/dino_transfer_hook.so

echo "› deploying dino_governance"
solana program deploy \
  --keypair "$EXPECTED_WALLET" \
  --program-id target/deploy/dino_governance-keypair.json \
  target/deploy/dino_governance.so

echo
echo "✓ deploy complete. Program IDs:"
solana-keygen pubkey target/deploy/dino_core-keypair.json
solana-keygen pubkey target/deploy/dino_transfer_hook-keypair.json
solana-keygen pubkey target/deploy/dino_governance-keypair.json

echo
echo "Next steps:"
echo "  1. Update Anchor.toml [programs.mainnet] with the IDs above"
echo "  2. Update declare_id! in each program's lib.rs"
echo "  3. Rebuild and run 'solana program deploy' once more to align"
echo "     the declared ID with the deployed address (see Anchor docs)"
echo "  4. Run scripts/init-platform.ts with mainnet provider"
echo "  5. Transfer upgrade authority to multisig via"
echo "     scripts/transfer-upgrade-authority.sh"
echo "  6. Update DO + Vercel env vars to mainnet values"
