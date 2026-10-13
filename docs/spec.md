# Invoseal — product spec

## Problem
Ravi makes plastic buckets. He delivers ₹2,40,000 of goods to a big retailer that pays in 60 days, but he needs cash
this week. A lender can advance 85% against the invoice, but the paper is the whole risk. The lender needs four
answers: **Is it genuine? Was it delivered? Will the buyer pay? Is it already financed elsewhere?**
Today people check scattered documents (invoice, PO, delivery receipt) by hand: slow, and duplicates slip through.

## Answer
Invoseal reads the invoice (AI), tests it against the purchase order, the delivery receipt and company records (code),
explains the result in plain English, and records every step in a tamper-evident audit chain. Batch roots of that
chain are anchored on a blockchain. Documents stay private; only hashes leave the database.

Real world: India's RBI-regulated TReDS platforms (RXIL, Invoicemart, M1xchange) list invoices that buyers accept and
financiers bid on. Invoseal is a prototype: one mock lender, mock data, no money moves, not licensed.

## Roles (email + password, role in `profiles.role`)
| Role | Does | Sees |
|---|---|---|
| supplier | uploads, checks the AI fields beside the document, submits | own invoices, their checks and offers |
| buyer | confirms or disputes | invoices raised on them, after the supplier submits |
| lender | approves or rejects flagged invoices | everything, ranked by risk |
| auditor | verifies the chain, anchors batches | everything, read-only |

## Flow and statuses
`uploaded` (file stored + hashed) → `extracted` (AI fields ready) → supplier submits → checks run:
- any **fail** → `rejected`
- any **warn**, AI confidence < 0.8, or buyer credit < 70 → `review` → lender approves (`approved`) or rejects
- otherwise → `checked` (auto-approve, waiting for the buyer)

Buyer confirms → once the invoice is `checked` or `approved`, the offer is released → `offer_released`.
Buyer disputes → `review`. Separate column `buyer_status`: pending · confirmed · disputed.

## Screens
- **Login** with a demo-account picker (fills the email; the password is typed).
- **Supplier:** My invoices → Upload (camera or file) → Review (document beside the extracted fields) → Invoice detail.
- **Buyer:** To confirm → Invoice detail → Confirm / Dispute.
- **Lender:** Queue ranked by risk with filters → Invoice detail → Approve / Reject.
- **Auditor:** Audit trail with head hash → Verify chain → Anchored batches (on-chain check on the anchor laptop).
- **Invoice detail (shared):** document · fields · three-way match matrix · risk table + explanation · buyer credit ·
  offer · this invoice's audit entries.

## Edge functions (the API)
| Function | Caller | Does |
|---|---|---|
| `extract-invoice` | supplier | checks type/size, hashes the file, creates the invoice, reads fields (cache → Gemini → manual), audits `invoice_uploaded` |
| `run-checks` | supplier | saves confirmed fields, runs checks, scores, decides; audits `fields_extracted`, `checks_completed`, `decision_made` |
| `invoice-action` | buyer, lender | confirm, dispute, approve, reject; re-checks integrity; releases the offer; audits each step |
| `verify-chain` | lender, auditor | walks the chain, re-hashes records and files, recomputes anchored batch roots |
| `record-anchor` | auditor (anchor script) | stores a batch root after recomputing it from the DB |

Live updates use Supabase Realtime on `invoices` (RLS applies).

## Milestones (6 hours)
| # | Time | Goal | Done when |
|---|---|---|---|
| M1 | 0:00–0:45 | 9 tables, RLS + tests, seed, login by role, blank APK | demo users land on their role's home; denied-case tests pass; APK builds (PWA as fallback) |
| M2 | 0:45–1:45 | Upload, hashes, AI extraction, review screen | photo/PDF → fields beside the document; edits tracked; cache + manual fallback |
| M3 | 1:45–2:45 | Engine: normalize, checks, match matrix, risk score | `npm test` green; 6 samples give the expected results in `docs/checks.md` |
| M4 | 2:45–3:30 | Buyer confirm/dispute, credit, decision, offer, lender actions | S1 → ₹2,04,000 offer after the buyer confirms |
| M5 | 3:30–4:30 | Audit chain, Verify (4 tamper types), Merkle anchoring, demo reset | editing a row turns Verify red at the exact entry; roots match on-chain |
| M6 | 4:30–5:20 | Lender dashboard, empty/error states, realtime, Vercel, final APK | the demo in `docs/demo.md` runs end to end twice |
| — | 5:20–6:00 | Rehearse, backup recording, buffer | |

**Cut order if late:** realtime → image hash → behaviour checks → on-chain check in the browser (CLI stays).
**Stretch:** verification QR with a Merkle proof per approved invoice; 2–3 mock lender offers.

## Non-goals
Real payments, KYC, real GST lookups, multi-currency, notifications, password reset, sign-up, admin UI.
Future scope (say it in the pitch): GST/e-invoice lookups, logistics delivery proof, payment tracking, public-chain anchoring.
