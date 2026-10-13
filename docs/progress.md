# Progress / handoff (update after every milestone)

## Done (13 Oct 2026, first session)
- Plan approved: docs/ rewritten to merge the original prompt, the team guide (`docs/sources/build-guide.pdf`)
  and the extra requirements (`docs/sources/requirements-v2.md`). Decisions: two scores (invoice risk + buyer credit),
  rules first (fail = reject, warn = review), Hardhat local chain, image hash computed in the app.
- **Engine done (M3 core), offline:** `supabase/functions/_shared/` has types, normalize, canon, checks (21 checks),
  risk, credit, decide, audit (hash chain + verify), merkle. `npm test` → **23 passing**. All 6 samples give the
  results in `docs/checks.md` (S1 0 → 85%, S2 60 reject, S3 18 review, S4 15 reject, S5 0 → 75%, S6 63 reject).
- **Samples:** `samples/world.json` (single source of truth), `tools/make_samples.py` → 6 PNG invoices,
  `samples/manifest.json` (SHA-256 + image hash), `supabase/functions/_shared/sample-cache.json` (AI fallback).
  Arial has no ₹ glyph, so invoices print "Rs." (normalisation handles both).
- Repo: `git init` on `main`, `.gitignore` covers env files, builds, APKs. Nothing committed yet.

## Blocked: Supabase project (needs the user)
The connected Supabase account (org "iraquarium6-glitch's Org", free plan) already has 2 active free projects
("chat work", "iraquarium6-glitch's Project"), so creating `invoseal` failed. The Gracy game uses a different
account, so it's unaffected either way. The user must either pause one of those two projects (then create
`invoseal` in ap-south-1 via the Supabase MCP, cost $0 confirmed) or use a teammate's account + `npx supabase login`.

## Next steps, in order
1. Supabase project → migrations (schema, RLS, storage bucket, realtime), `tools/gen-seed.ts` → seed (demo password
   generated into `.env.local` as `DEMO_PASSWORD`, applied with `set_config('invoseal.demo_password', …)`), RLS tests.
   Check auth.users columns before writing the user-seed SQL (token columns must be '' not NULL).
2. App scaffold (`app/`): Vite 8 + React 19 + Tailwind 4 + react-router 7 (HashRouter) + supabase-js; login by role;
   Capacitor 8 Android (JAVA_HOME=/opt/homebrew/opt/openjdk@21, SDK at ~/Library/Android/sdk). No phone was connected.
3. Edge functions: extract-invoice, run-checks, invoice-action, verify-chain, record-anchor (see docs/spec.md).
   The user must set the Edge Function secret `GEMINI_API_KEY` themselves (they pasted a key in chat once: it must be
   rotated, never used).
4. `chain/`: Hardhat (npm shows 3.19.0 latest) node + AnchorRegistry.sol + anchor/verify scripts.
5. Small polish noticed: reasons print "₹36,610.2" (force 2 decimals when there are paise) and "Ravi Plastics's".

## Tool versions seen (npm, 13 Oct 2026)
vite 8.3.4 · vitest 5.0.4 · react 19.3.0 · react-router 8.4.0 · tailwindcss 4.3.3 · @supabase/supabase-js 2.117.3 ·
@capacitor/* 8.5.3 · hardhat 3.19.0 · ethers 6.17.0 · Node 26.5 (runs .ts directly).
