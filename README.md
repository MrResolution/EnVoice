# Invoseal

**Invoice financing a lender can actually verify.** A seller uploads an invoice their buyer pays later, the buyer
confirms the goods arrived, a lender advances up to 85%. AI reads the invoice, 21 written rules decide, and every
step goes into a hash-chained audit log whose batch roots are anchored on a blockchain.

SYNESIS 26 · Fintech · "Invoice Financing with Hybrid Audit Architecture". Prototype: mock data only, no real money.

- **Live web app:** https://invoseal.vercel.app
- **Android:** build with `npm --prefix app run apk` (debug APK)
- **How to use it (seller, buyer, lender, demo script):** [docs/user-guide.md](docs/user-guide.md)

## Features
- **Seller app (mobile):** scan or upload, AI field extraction with confidence, fields beside the document with edits
  flagged, 21 checks that run live, risk gauge with plain-English reasons, offer and accept, payouts.
- **Buyer app (mobile):** raise purchase orders, record deliveries (short deliveries too), confirm or dispute invoices
  against your own PO and delivery record.
- **Lender dashboard (web):** queue ranked by risk, side panel to approve or reject, portfolio exposure by buyer,
  audit chain verification.
- **Sign-in:** Google, email, or demo accounts; new users onboard as seller or buyer (no KYC in the prototype).
- **Checks:** three-way match (invoice vs PO vs delivery), duplicates (same file, look-alike numbers, near-duplicates,
  image hash), self-dealing and bank changes, document integrity, behaviour signals. Any fail rejects; warnings go to
  a person; the score explains and ranks but never overrides a rule.
- **Hybrid audit:** private files and data in Supabase (RLS on every table), a SHA-256 hash chain in Postgres, Merkle
  roots of each batch on a local Hardhat chain. Verify catches edited entries, removed entries, changed invoice rows
  and swapped files.

## Stack
React 19 + Vite + Tailwind 4 + `motion` (Capacitor 8 for Android) · Supabase (Postgres, RLS, Auth, Storage, Edge
Functions, Realtime) · Gemini (extraction only) · Hardhat 3 + Solidity (`AnchorRegistry`).

## Run it
```bash
npm install && npm --prefix app install && npm --prefix chain install
npm test                       # engine unit tests
npm --prefix app run dev       # web app on localhost:5173 (needs .env.local)
npm run e2e                    # demo flow through the live functions
npm run e2e:signup             # new-account flow (sign-up → PO → invoice → offer → accept)
npm --prefix chain run node    # local chain, then: npm --prefix chain run anchor / verify
```
`.env.local` (not in git) holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DEMO_PASSWORD`, and the Google client.
More in [CLAUDE.md](CLAUDE.md) and [docs/](docs/).
