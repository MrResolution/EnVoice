# Demo script (4 minutes)

## Before going on stage
- [ ] Run `supabase/demo_reset.sql` in the SQL editor, then pre-load **S5** (upload as Ravi, buyer Banyan confirms)
      and **S3** (upload as Ravi) so the lender queue isn't empty.
- [ ] Laptop: `npm --prefix chain run node` running, then `npm --prefix chain run anchor` once.
- [ ] Phone: APK installed and logged out (backup: the Vercel URL on the laptop). Samples S1, S4, S6 on the phone.
- [ ] Laptop tabs: auditor screen (`npm --prefix app run dev`), Supabase SQL editor with the tamper query.
- [ ] Phone on mobile data or a hotspot (don't trust venue Wi-Fi). Gemini cache present for all samples.

## Demo accounts
`ravi`, `kaveri` (suppliers) · `peacock`, `banyan` (buyers) · `lender` · `auditor`, all `@invoseal.test`.
Password: `DEMO_PASSWORD` in `.env.local`. Mock accounts only; never reuse a real password.

## Story
| Time | Beat | What judges see |
|---|---|---|
| 0:00 | Problem | Ravi's story in 20 s; the four lender questions |
| 0:20 | Clean (S1) | Upload as Ravi → fields beside the document → submit → all green, risk 0 LOW → switch to Peacock → Confirm → Ravi sees **₹2,04,000 advance (85%)** with reasons |
| 1:10 | Edited copy (S6) | Upload → **Risk 63/100 — HIGH**: exceeds PO and PO already used; near-duplicate of INV-1001 (number differs by one character); bank account changed; totals don't add up |
| 1:50 | Mismatch (S3, pre-loaded) | Lender opens it: match matrix shows **100 billed vs 80 delivered (+25%)** → manual review |
| 2:15 | Self-dealing (S4) | Upload as Kaveri → **rejected: supplier and buyer share bank account ••7788**. Credit is 93, but a hard rule is a hard rule |
| 2:40 | Tamper (S5) | Auditor: Verify → green, head hash shown. SQL editor: `update invoices set amount = 885000 …` → Verify → **red: INV-0998 changed after entry #N (amount ₹88,500 → ₹8,85,000)**. Batch root still matches on-chain |
| 3:20 | Access denied | Log in as Kaveri and open Ravi's invoice link → not visible. "Access denied is a feature." |
| 3:30 | Wrap-up | AI reads, code decides, the chain proves it. Real vs mock, future scope. Questions |

## Expected results
S1 approve 85% · S2 reject (60) · S3 review (18) · S4 reject (15) · S5 approve 75%, then red after the DB edit ·
S6 reject (63). Details in `docs/checks.md`.

## Judge Q&A
- **Real blockchain?** A hash chain in Postgres, plus each batch's Merkle root on a local Hardhat chain. Production
  anchors to a public chain or a timestamping service.
- **Can an admin rewrite the log?** Consistently, yes, but then the batch roots stop matching the on-chain roots.
- **How accurate is the AI?** It only reads. The supplier checks the fields beside the document, edits to money or
  bank fields are flagged, low confidence goes to review, and every decision is a deterministic rule.
- **Licensed? Real money?** No. Prototype with mock data. Real platforms in India are RBI-regulated TReDS.
- **Privacy?** Private bucket, 60-second links, RLS per role, only hashes in the log, only roots on-chain.
- **Scale?** Each check is an independent function; matching columns are indexed; heavy work can move to a queue.

## If something breaks
Gemini down → cache or manual entry. APK broken → Vercel PWA. Local chain restarted → `npm --prefix chain run anchor`
redeploys and re-anchors. Supabase slow → the backup recording.
