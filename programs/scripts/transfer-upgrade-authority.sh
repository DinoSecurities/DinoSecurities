#!/usr/bin/env bash
# Transfer upgrade authority on the three programs from the single deployer
# keypair to a multisig (Squads V4 recommended). This is the single most
# important security step before anyone sends real money into the contracts.
#
# Usage:
#   MULTISIG_PUBKEY=<your-squads-multisig-pubkey> \
#   DEPLOYER_KEYPAIR=$HOME/.config/solana/dinosecurities-deployer-mainnet.json \
#   bash scripts/transfer-upgrade-authority.sh
set -euo pipefail

if [[ -z "${MULTISIG_PUBKEY:-}" ]]; then
  echo "✗ MULTISIG_PUBKEY env var required"
  exit 1
fi

DEPLOYER_KEYPAIR="${DEPLOYER_KEYPAIR:-$HOME/.config/solana/dinosecurities-deployer-mainnet.json}"

if [[ ! -f "$DEPLOYER_KEYPAIR" ]]; then
  echo "✗ deployer keypair not found at $DEPLOYER_KEYPAIR"
  exit 1
fi

# Read program IDs from Anchor.toml [programs.mainnet]. Bash parsing: look
# for the three keys under that section.
ANCHOR_TOML="$(dirname "$0")/../Anchor.toml"
DINO_CORE=$(awk '/\[programs.mainnet\]/{flag=1; next} /^\[/{flag=0} flag && /^dino_core/ {gsub(/"/,"",$3); print $3}' "$ANCHOR_TOML")
DINO_HOOK=$(awk '/\[programs.mainnet\]/{flag=1; next} /^\[/{flag=0} flag && /^dino_transfer_hook/ {gsub(/"/,"",$3); print $3}' "$ANCHOR_TOML")
DINO_GOV=$(awk '/\[programs.mainnet\]/{flag=1; next} /^\[/{flag=0} flag && /^dino_governance/ {gsub(/"/,"",$3); print $3}' "$ANCHOR_TOML")

echo "› transferring upgrade authority to $MULTISIG_PUBKEY"
for PROGRAM in "$DINO_CORE" "$DINO_HOOK" "$DINO_GOV"; do
  echo "  - $PROGRAM"
  solana program set-upgrade-authority \
    --keypair "$DEPLOYER_KEYPAIR" \
    --new-upgrade-authority "$MULTISIG_PUBKEY" \
    "$PROGRAM"
done

echo
echo "✓ upgrade authority transferred."
echo "  Verify with: solana program show <program-id>"
echo "  Expected 'Authority' field: $MULTISIG_PUBKEY"
echo
echo "From this point forward, program upgrades require multisig approval."
echo "Keep the deployer keypair safe but offline — it has no on-chain power."
