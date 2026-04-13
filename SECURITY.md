<p align="center">
  <img src="public/favicon.png" alt="DinoSecurities" width="72" height="72" />
</p>

<h1 align="center">Security Policy</h1>

<p align="center">
  <strong>Responsible disclosure for the DinoSecurities platform, smart contracts, and infrastructure.</strong>
</p>

---

## Our Commitment

DinoSecurities issues legally enforceable security tokens on Solana. The integrity of our on-chain compliance logic, transfer hooks, settlement flows, and off-chain indexing is paramount. We treat every credible security report with urgency and gratitude.

We are committed to:

- Acknowledging reports within **48 hours**.
- Providing a triage decision within **5 business days**.
- Coordinating a fix and public disclosure with the reporter.
- Crediting researchers who follow this policy (unless anonymity is requested).

## Supported Versions

Security patches are applied to the latest minor release on the `main` branch. Older pre-1.0 releases are not individually maintained; please upgrade before reporting.

| Version | Supported |
| ------- | --------- |
| `main`  | ✅ |
| Latest tagged release | ✅ |
| Older pre-1.0 tags | ❌ |

## Scope

**In scope**

- Smart contracts: `dino-core`, `dino-hook`, `dino-gov`
- Transfer Hook logic, compliance rules, HolderRecord PDAs
- Atomic DvP settlement flows
- tRPC server, webhook handlers, authentication, signature verification
- Frontend wallet integration and transaction construction
- Supply-chain or dependency issues uniquely exploitable via this codebase

**Out of scope**

- Third-party services (Helius, Pinata, Arweave, Irys, KYC providers) — report directly to the vendor.
- Issues requiring physical access, social engineering, or compromised user devices.
- Denial of service via volumetric network attacks.
- Missing security headers without a demonstrable exploit.
- Reports generated solely by automated scanners without proof of impact.

## Reporting a Vulnerability

**Please do not open public GitHub issues for security reports.**

Report privately via either channel:

1. **GitHub Private Advisory** (preferred) — [Report a vulnerability](https://github.com/DinoSecurities/DinoSecurities/security/advisories/new)
2. **Email** — `security@dinosecurities.com`

Include, where possible:

- A clear description of the issue and its impact.
- Step-by-step reproduction (code, transactions, signatures, or proof-of-concept).
- Affected components, commit hashes, or program IDs.
- Suggested remediation, if any.
- Your name or handle for credit (optional).

For highly sensitive reports, request our PGP key in your first message and we will respond with a fingerprint out-of-band.

## Severity & Response Targets

| Severity | Example | Initial Response | Target Fix |
| --- | --- | --- | --- |
| **Critical** | Fund loss, unauthorized mint, bypass of transfer restrictions | < 24 h | < 7 days |
| **High** | Privilege escalation, KYC bypass, signature forgery | < 48 h | < 14 days |
| **Medium** | Indexer desync, auth edge case, data exposure | < 5 days | < 30 days |
| **Low** | Hardening, defense-in-depth, informational | < 10 days | Next release |

## Safe Harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, or service disruption.
- Do not exploit a vulnerability beyond what is necessary to demonstrate it.
- Do not disclose the issue publicly until we have confirmed a fix or 90 days have elapsed, whichever is sooner.
- Comply with all applicable laws.

## Disclosure Policy

We follow **coordinated disclosure**. Once a fix is released, we will:

1. Publish a GitHub Security Advisory with a CVE where applicable.
2. Credit the reporter in the advisory and release notes.
3. Share post-mortem details when relevant to the broader Solana ecosystem.

---

<p align="center">
  <sub>Thank you for helping keep DinoSecurities and the Solana ecosystem safe.</sub>
</p>
