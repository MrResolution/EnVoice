# Progress / handoff (update after every milestone)

## Done (13 Oct 2026)
**Session 1:** docs merged from the build guide + extra requirements. Engine (M3 core) in `supabase/functions/_shared/`
(21 checks, risk, credit, decide, audit chain, merkle). Samples: `samples/world.json` → 6 PNGs, manifest, AI cache.

**Session 2 (everything that doesn't need the database, written and checked offline):**
- `supabase/migrations/` (3 files): 9 tables, RLS select-only policies + revoked write privileges, private bucket
  with folder policies, Realtime on `invoices`. `supabase/demo_reset.sql`.
- `tools/gen-seed.ts` → `supabase/seed.sql` (`npm run seed`). Creates `DEMO_PASSWORD` in `.env.local` if missing;
  the seed holds only a bcrypt hash (devDependency `bcryptjs`), so the password never appears in SQL or tool calls.
- Edge functions: `extract-invoice`, `run-checks`, `invoice-action`, `verify-chain`, `record-anchor` + `_shared/db.ts`
  (service client, role check, `appendAudit` with prev_hash retry), `_shared/fields.ts` (validates the AI reply,
  sniffs the real file type, matches the buyer), `_shared/gemini.ts`. `deno check` passes on all five.
- `npm test` → **30 passing** (engine + fields/sniff/record-hash tests). `tests/rls.test.ts` written (allowed + denied
  cases), runs once the DB exists.
- `app/`: Vite 8 + React 19 + Tailwind 4 + react-router 8 (HashRouter) + supabase-js. Login with demo picker; supplier
  home/upload (camera, file, or one-tap demo samples)/review (document beside fields, edits highlighted); buyer
  confirm/dispute; lender queue ranked by risk with filters; auditor trail + Verify + on-chain root check (plain
  JSON-RPC); shared invoice detail (offer, risk table, buyer credit, match matrix, all checks, audit entries).
  `npm --prefix app run build` passes. In-app image hash is within 1–3 bits of the Python one (BOX edges), well
  inside the 10-bit near-duplicate tolerance.
- `chain/`: Hardhat 3.19 + `AnchorRegistry.sol` (append-only roots + `Anchored` event), `anchor` / `verify` scripts
  (sign in as the auditor, never the service key). Smoke test passed: deploy → anchor → read the root back from the tx.
- Android: `app/android` added (Capacitor 8, CAMERA permission for "Take a photo"); `npm --prefix app run apk` →
  `app/invoseal-debug.apk` (5 MB) builds in ~15 s. Not yet tried on a phone.

## Live on Supabase (project `vygzqjpquizwwthhhxbd`, ap-south-1, new account; CLI logged in to it)
- Migrations + seed applied with `npx supabase db query --linked --project-ref vygzqjpquizwwthhhxbd -f <file>`
  (Management API, no DB password). Note: the CLI retries, so a second run of a migration reports "already exists".
- 5 functions deployed with `npx supabase functions deploy <fn> --project-ref vygzqjpquizwwthhhxbd --use-api`.
- `npm run test:rls` → **15/15**. `npm run e2e` (tools/e2e.ts) → the whole demo through the real functions:
  S5 75% ₹66,375 · S3 review → lender approve → offer · S1 ₹2,04,000 · S2 reject 60 (source "reuse") · S6 reject 63 ·
  S4 reject 15 · role/RLS refusals · Verify green. Run it after `supabase/demo_reset.sql`.
- Tamper (as owner): changed row → "INV-0998 changed after entry #2: amount ₹88,500 → ₹8,85,000"; edited entry →
  "Entry #5 was changed after it was written"; both red as expected, green again after undo.
- Chain: `npm --prefix chain run node` + `anchor` → batch #1 (#1–#31) on-chain; `verify` → matches.
- Web backup live: **https://invoseal.vercel.app** (Vercel project `invoseal`, static `app/dist` staged in the
  git-ignored `deploy/invoseal`). Redeploy: `npm run deploy:web`. Deploying from the repo makes Vercel try to link the
  GitHub remote; the staged folder is already linked, so that only happened once.
- Polish done: "₹36,610.20" (2 decimals with paise), "Ravi Plastics'". `npm test` → 31.

## Session 3 (13 Oct): redesign + self sign-up
- Design canvas (Claude Design): https://claude.ai/artifact/PQqELWVWnfmpsagoBP5vG5 — near-black + lime on light grey,
  approved by the user (login kept from round 1). App rebuilt to match: Plus Jakarta Sans, `app/src/ui/` kit
  (motion springs, sheets, toasts, count-ups, risk ring, staggered checks), `motion` 12 for animation.
- Sign-in: Google (web redirect; APK via system browser + deep link `test.invoseal.app://login-callback`,
  @capacitor/app + @capacitor/browser) and email sign-up (confirmations off via `supabase/config.toml` + config push).
  New accounts onboard as seller or buyer (`onboard` function, no KYC). Demo accounts still work.
- Buyers raise POs and record deliveries (`orders` function); sellers accept offers (`invoice-action` accept).
  Migration 4 adds parties.owner_id/city, PO/receipt creators, offer accepted state, new audit events.
- Lender gets a web dashboard (`/l`: KPIs, risk-ranked table, side panel decide, portfolio exposure, audit chain).
- `npm run e2e:signup` → full new-account flow passes. Verified in the browser: sign-up → onboarding → upload →
  manual fields → checks animation → risk 25 review → lender approve (toast + live KPIs) → verify chain intact.
- Google provider ON (client in .env.local as GOOGLE_CLIENT_ID/SECRET, pushed via config.toml env()). Verified on
  invoseal.vercel.app: Google → back → onboarding. Rotate the secret after the event (it was pasted in chat).

- Lenders can now self-onboard (Google or email → "I lend money" → company name). Prototype trade-off: any lender
  sees every submitted invoice; a real platform would invite and verify lenders. Auditors stay seeded.

## Session 4 (13 Oct, last stretch): bug hunt + AI scanning
- **Security hole closed:** policies "Allow public read/insert/update on invoices" and ALL privileges for anon had been
  added by hand in the SQL editor (anyone with the public key could read, edit or truncate invoices). Dropped; migration
  6 re-asserts read-only access on every table; new RLS test "anonymous visitors cannot write or wipe invoices".
- **Gemini was never running:** every model name tried (1.5/2.0 flash) is retired (404). `_shared/gemini.ts` now tries
  `GEMINI_MODEL` then `gemini-flash-latest` / `gemini-2.5-flash` / `gemini-flash-lite-latest`, key in a header, errors
  mapped to a short reason (no raw API text to users). Live: S1 copy read perfectly in 12 s, a shaded skewed photo in 29 s.
- **Invented data removed:** when the AI failed, extract-invoice copied the seller's latest PO into the invoice (with
  Ravi's bank account as a default) and the Review "Match PO" chips overwrote document amounts with PO amounts: both made
  the three-way match pass by construction. Now the chips only link PO + buyer for read invoices (full pre-fill only for
  hand-typed ones, which a lender reviews), and "Create manually" uploads an honest "no paper invoice" placeholder.
- **On-device reader (Tesseract + parser):** new source `ocr` (migration 5): it is the seller's own reading, so the
  Extraction check always warns and it is never reused. Parser rewritten with GSTIN structure repair, PO/date/number
  look-alike repair, rupee-first currency, real confidence + "check this" fields; it never "fixes" arithmetic.
  Real-OCR benchmark (`OCR_BENCH=all npx vitest run src/test/ocr-real.test.ts` in app/): 11 clean samples 100%;
  20 phone-photo look-alikes 73% → 98% with the new parser and upscaling of small images.
- Other fixes: onboarding stored the city as the address (same-city firms were rejected as self-dealing; 20 rows fixed);
  empty AI readings count as unread; delivery dates use India time; GSTIN warning when none on file; count-ups never show
  fractions; page transitions no longer wait for the old page's exit (navigation could look frozen).
- Data: seeded PO-4501..4504 + GRN-7001..7004 had been deleted (demo S1/S3/S5/S6 would fail "PO found"): restored.
  INV-5101's amount was set to ₹1 directly in the DB after it was recorded: Verify flags it (left for the team).
  DS-8801 dates in samples/DATASETS.json corrected (the image prints 13 Oct / 12 Dec).
- Before the demo: run `supabase/demo_reset.sql` (clears test invoices incl. QA-001 and the tampered INV-5101).

## Next steps
1. Click through every role in the app (browser pane / phone) and fix UI issues.
2. User: set Edge Function secret `GEMINI_API_KEY` (new key) for live AI on non-sample files.
3. Install the APK on a phone (rebuilt 11:18 with the latest code).
4. Before stage: `supabase/demo_reset.sql`, pre-load S5 (+Banyan confirm) and S3, anchor once (docs/demo.md).

## Tool versions (npm, 13 Oct 2026)
vite 8.3.4 · vitest 5.0.4 · react 19.3.0 · react-router 8.4.0 · tailwindcss 4.3.3 · @supabase/supabase-js 2.117.3 ·
@capacitor/* 8.5.3 · hardhat 3.19.0 · ethers 6.17.0 · typescript 7.0.2 · deno 2.9.6 (via npx) · Node 26.5.
