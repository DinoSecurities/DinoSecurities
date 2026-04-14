# Terms of Service

**Version 0.1 (beta) — Last updated 2026-04-14**

These terms apply to your use of the DinoSecurities protocol and the reference UI hosted at https://www.dinosecurities.com (together, the "Protocol"). By connecting a wallet to the reference UI, or by interacting on-chain with the Protocol's programs, you agree to these terms. If you don't agree, don't use the Protocol.

> This document is a plain-language disclaimer and user agreement, not a legal opinion. It has not been reviewed by securities counsel. Before relying on it as your sole user-facing legal document, have it reviewed by a lawyer in your jurisdiction.

---

## 1. What the Protocol is

The Protocol is a set of open-source Solana programs (`dino_core`, `dino_transfer_hook`, `dino_governance`) together with a reference web UI. It provides composable primitives:

- Mint **Token-2022** tokens with pre-wired extensions (Transfer Hook, Metadata Pointer, Permanent Delegate)
- Enforce per-mint allowlists through on-chain `HolderRecord` PDAs
- Swap tokens for payment tokens atomically (DvP) without a trusted escrow
- Per-mint DAO governance

Source code: https://github.com/DinoSecurities/DinoSecurities

## 2. What the Protocol is not

The Protocol is not:

- An **issuer** of any security, investment contract, or financial instrument
- A **broker-dealer**, **alternative trading system (ATS)**, **transfer agent**, **custodian**, **clearing agency**, or **investment adviser** under US federal or state securities laws, or their equivalents in any other jurisdiction
- A **bank**, **money transmitter**, or **payment processor**
- An **offering platform** that reviews, endorses, underwrites, or otherwise vouches for tokens minted through it

Operators of the Protocol do not take custody of user funds. All transactions are signed by the user's own wallet and executed directly against the Solana blockchain. The reference UI is provided as a convenience; any user may interact with the on-chain programs directly, via any client of their choosing.

## 3. Experimental beta software

The Protocol is **experimental beta software**. It has not been audited by a third party at the time of writing. It may contain bugs, logic errors, or vulnerabilities that could result in loss of funds, loss of access to your assets, unintended transfers, failed settlements, or other adverse outcomes.

**Use at your own risk. Do not commit funds you cannot afford to lose.**

## 4. User responsibilities

You, as a user of the Protocol, are solely responsible for:

1. **Compliance with applicable law.** Whether you are deploying a mint, holding a token, trading a token, or voting in governance, you are responsible for complying with securities, commodities, tax, sanctions, anti-money-laundering, know-your-customer, and any other laws applicable to you in every jurisdiction where you reside or operate.
2. **Regulatory characterization.** The Protocol's primitives (Reg D / Reg S / Reg CF / Reg A+ restriction codes, accreditation flags, jurisdiction fields) are developer-facing configuration options. Setting a restriction to "RegD" in your mint's parameters does not mean your offering qualifies for the Reg D exemption. That determination is yours to make with your own counsel.
3. **Tax reporting.** Transactions on the Protocol may give rise to tax liability. The Protocol does not withhold, report, or advise on taxes.
4. **Counterparty risk.** When you trade against another wallet via DvP, you are transacting with that wallet's operator. The Protocol provides atomic settlement; it does not vouch for counterparty identity or creditworthiness beyond the information held in the on-chain allowlist.
5. **Key management.** You are responsible for the security of your wallet and private keys. Lost or stolen keys cannot be recovered by the Protocol operators.

## 5. No investment advice

Nothing in the reference UI, the documentation, the Twitter account, or any other Protocol-related communication constitutes investment advice, financial advice, tax advice, legal advice, or a recommendation to buy, sell, or hold any token. You should consult qualified professionals before making any financial decision.

## 6. Permissionless deployment

Anyone can deploy a mint through the Protocol. The operators of the reference UI do not pre-screen, approve, or vet the tokens, documents, issuers, or holders that appear in the UI. The presence of a token on dinosecurities.com is not an endorsement and is not a representation that it is legal to offer, trade, or hold in any jurisdiction.

## 7. KYC / identity verification

The reference UI integrates with a third-party identity verification provider (currently Didit) as an **optional feature**. If you use that integration:

- The KYC flow is governed by the provider's own terms and privacy policy
- KYC data (other than the on-chain `HolderRecord` metadata you agree to publish) is held by the provider, not by the Protocol operators
- Completing KYC through the Protocol does not establish a broker-dealer, advisor, or fiduciary relationship with the Protocol operators

## 8. Sanctions and restricted persons

You represent that you are not located in, under the control of, or a resident of any country or region subject to comprehensive US sanctions (e.g. OFAC-restricted jurisdictions), and that you are not named on any US or international sanctions list (OFAC SDN, EU consolidated, UN, UK HMT, etc.). If you are, you may not use the Protocol.

## 9. No warranty

THE PROTOCOL IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, OR UNINTERRUPTED OPERATION.

## 10. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE PROTOCOL OPERATORS, CONTRIBUTORS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES (INCLUDING LOSS OF PROFITS, GOODWILL, DATA, OR TOKENS) ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE PROTOCOL, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

Where limitation of liability is not permitted by applicable law, liability is limited to the maximum extent permitted.

## 11. Indemnification

You agree to indemnify and hold harmless the Protocol operators and contributors from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to (a) your use of the Protocol, (b) your violation of these terms, or (c) your violation of any applicable law or third-party right.

## 12. Open source license

The Protocol source code is released under the Apache License 2.0. See [LICENSE](LICENSE). Your rights under the open source license are separate from these terms — the license governs what you may do with the code; these terms govern your use of the hosted reference UI and the on-chain programs operated by the Protocol operators.

## 13. Changes to these terms

These terms may be updated from time to time. Material changes will be posted to the repository and reflected in the version number at the top of this document. Continued use of the Protocol after an update constitutes acceptance of the updated terms.

## 14. Contact

Security issues: see [SECURITY.md](SECURITY.md).

All other: open an issue on the GitHub repository, or reach out on Twitter: https://x.com/SecuritiesDino
