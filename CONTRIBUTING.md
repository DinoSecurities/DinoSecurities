<p align="center">
  <img src="public/favicon.png" alt="DinoSecurities" width="72" height="72" />
</p>

<h1 align="center">Contributing to DinoSecurities</h1>

<p align="center">
  <strong>Thank you for helping build the future of tokenized securities on Solana.</strong>
</p>

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Branching & Commits](#branching--commits)
- [Pull Requests](#pull-requests)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Security](#security)
- [License](#license)

## Code of Conduct

Participation in this project is governed by a simple principle: **be professional, be kind, be rigorous**. Harassment, discrimination, or bad-faith behavior will not be tolerated. Report conduct concerns to `conduct@dinosecurities.com`.

## Ways to Contribute

| Type | Where |
| --- | --- |
| 🐛 Bug reports | [GitHub Issues](https://github.com/DinoSecurities/DinoSecurities/issues) |
| ✨ Feature proposals | [GitHub Discussions](https://github.com/DinoSecurities/DinoSecurities/discussions) |
| 🔐 Security vulnerabilities | [SECURITY.md](SECURITY.md) — **do not** open a public issue |
| 📖 Documentation | PRs welcome against `README.md` and inline docs |
| 💻 Code | Fork → branch → PR (see below) |

## Development Setup

**Prerequisites**

- [Bun](https://bun.sh) ≥ 1.1 (preferred) or Node.js ≥ 20
- PostgreSQL ≥ 15
- Solana CLI and Anchor (for on-chain work)
- A Solana devnet wallet (Phantom or Solflare)

**Install and run**

```bash
# Clone
git clone https://github.com/DinoSecurities/DinoSecurities.git
cd DinoSecurities

# Install dependencies
bun install

# Copy environment template
cp server/.env.example server/.env
# Fill in required values (see server/src/env.ts)

# Start the frontend
bun run dev

# Start the backend (in a separate terminal)
cd server && bun run dev
```

**Never commit secrets.** `.env`, `server/.env`, keypairs, and any file containing a live API key must remain local. The `.gitignore` is configured accordingly — do not bypass it.

## Branching & Commits

- Branch from `main`. Use descriptive names: `feat/transfer-hook-accreditation`, `fix/dvp-slippage`, `docs/readme-tech-stack`.
- Keep commits focused. Squash noisy WIP commits before opening a PR.
- Follow **[Conventional Commits](https://www.conventionalcommits.org/)**:

```
feat(compliance): enforce Reg S holding period in transfer hook
fix(server): verify tweetnacl signature against canonical message
docs(readme): document Helius webhook setup
chore(deps): bump @solana/web3.js to 1.98.4
```

Accepted types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Pull Requests

**Before opening a PR**

- [ ] Rebase on the latest `main`.
- [ ] `bun run lint` passes with no new warnings.
- [ ] `bun run test` passes.
- [ ] New code has meaningful tests.
- [ ] No secrets, `.env` files, or private keys included.
- [ ] User-facing changes are reflected in `README.md` or inline docs.

**Opening a PR**

1. Push your branch to your fork.
2. Open a PR against `DinoSecurities/DinoSecurities:main`.
3. Fill out the PR template: what, why, how tested, screenshots if UI.
4. Link related issues (`Closes #123`).
5. Mark as **Draft** if work is in progress.

**Review**

- Expect review within 3 business days.
- Address feedback via new commits (do not force-push during review).
- A maintainer will squash-merge once approved and CI is green.

## Coding Standards

**TypeScript / React**

- Strict TypeScript — no `any` without justification.
- Functional components, hooks, and co-located styles.
- shadcn/ui primitives over custom components when equivalent.
- Prefer `zod` schemas at trust boundaries (API, webhooks, env).

**Server / tRPC**

- All procedures input-validated with `zod`.
- Authentication via wallet signatures (`tweetnacl`); never trust client-provided wallet addresses.
- Database access only through Drizzle — no raw SQL without review.

**On-chain (Anchor / Rust)**

- Minimize account bloat; document every account constraint.
- Transfer Hook logic must be **deterministic and read-only** on external state.
- Use checked arithmetic; never truncate silently.
- Include unit tests and `anchor test` integration tests for every new instruction.

**Style**

- Formatter: Prettier (frontend/server), `rustfmt` (programs).
- Linter: ESLint; fix warnings before PR.
- File names: `kebab-case` for assets, `PascalCase` for React components, `camelCase` for utilities.

## Testing

| Layer | Tool | Command |
| --- | --- | --- |
| Frontend unit | Vitest + Testing Library | `bun run test` |
| Server unit | Vitest | `bun --cwd server run test` |
| On-chain | Anchor | `anchor test` |

Tests must not depend on live mainnet RPCs. Use devnet or local validators.

## Security

Do **not** report vulnerabilities through public issues or PRs.

See [SECURITY.md](SECURITY.md) for the disclosure process and safe harbor policy. Critical findings are acknowledged within 48 hours.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE), the same license that covers the project. You affirm that you have the right to submit the work under this license.

---

<p align="center">
  <sub>Built with care for the Solana ecosystem. 🦖</sub>
</p>
