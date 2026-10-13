# Checks engine

Pure TypeScript in `supabase/functions/_shared/` (no network, no DB) so vitest tests it directly and the
edge functions run the exact same code.

```ts
type Status = 'pass' | 'warn' | 'fail'
type Category = 'three_way' | 'duplicates' | 'vendor_bank' | 'integrity' | 'behaviour'
type CheckResult = { name: string; category: Category; status: Status; reason: string; values?: MatchValues }
type Check = (ctx: Ctx) => CheckResult | null      // null = not applicable (e.g. no PO to compare with)
// ctx = { invoice, supplier, buyer, po, receipt, others }  (loaded once by run-checks)
export const CHECKS: Check[] = [ ... ]               // new check = one function + one line + one test
```

## Normalize before comparing (`normalize.ts`)
`₹1,00,000` = `Rs. 100000.00` = `100000` · `11/10/2026` = `11 Oct 2026` = `2026-10-11` (day first) ·
`INV-1001` = `inv 1001` (look-alike pass also maps O→0, I/L→1, S→5, B→8) · `Ravi Plastics Pvt. Ltd.` = `ravi plastics` ·
GSTIN upper-case without spaces · bank account digits only, shown as ••4321 · `₹`/`Rs`/`INR` → `INR`.

## The checks
**Three-way match (weight 35)**: invoice vs purchase order vs delivery receipt. Rows carry `values` for the matrix.
| Check | pass | warn | fail |
|---|---|---|---|
| PO found | PO number exists for this buyer + supplier | — | no PO number, or PO doesn't exist |
| Delivery receipt | receipt exists, confirmed by buyer | — | missing, or not confirmed by the buyer |
| Amount vs PO | ≤ PO total | ≤ 2% over | > 2% over ("exceeds PO-4501 by ₹6,000") |
| PO balance | this + other active invoices ≤ PO total | — | over by > 2% ("already fully invoiced by INV-1001") |
| Quantity vs delivered | ≤ delivered + 2% | more than 2% over ("100 billed, 80 delivered, +25%") | — |
| Unit price vs PO | ≤ PO price + 2% | more than 2% over | — |
| Items vs PO | descriptions share ≥ 50% of words | otherwise | — |
| Invoice date vs delivery | within −2 … +30 days | outside that window | — |

**Duplicates (25)**
| Check | warn | fail |
|---|---|---|
| Same file | file seen before but that invoice was rejected | same SHA-256 as an active invoice |
| Same invoice number | — | same supplier + buyer + number (also after look-alike mapping) as an active invoice |
| Near-duplicate | ≥ 4 points vs an active invoice to the same buyer (below) | — |

Near-duplicate points: amount within 2% (+2) or within 10% (+1) · same items and quantity (+2) · date within 3 days (+1)
· invoice number differs by ≤ 2 characters (+1) · image hash within 10 of 64 bits (+1). Same-template invoices look alike,
so the image hash is only ever one point, never a verdict on its own.

**Vendor / bank (15)**
| Check | warn | fail |
|---|---|---|
| Self-dealing | — | supplier and buyer share GSTIN, bank account, phone, email domain (not gmail etc.) or address |
| Bank account | invoice account differs from the supplier's approved account | — |
| Vendor identity | name slightly altered (similarity 0.8–0.95), or GSTIN differs | different name AND different GSTIN |

**Document integrity (15)**
| Check | warn | fail |
|---|---|---|
| Fingerprint | — | no SHA-256 |
| Extraction | AI confidence < 0.8, or fields typed by hand (no AI cross-check) | invoice number, date, amount or buyer missing |
| Changed after AI reading | invoice number, vendor, amount, quantity, price or bank edited | — |
| Totals add up | line items + tax ≠ total (beyond ₹2 or 0.1%) | — |
| Currency | not INR | — |
| Chain integrity (at payout, in `invoice-action`) | — | record or file no longer matches the audit chain |

**Behaviour (10, warn only)**: amount > 3× the supplier's usual invoice · due date > 90 days after invoice date.
Ready to plug in later: round amounts just below a limit, weekend dates, sudden volume jumps, circular trading (A→B→C→A).

## Risk score (`risk.ts`)
```
risk  = Σ weight × (pass 0 · warn 0.5 · fail 1)      category status = worst check in it; rounded to an integer
level = any fail → HIGH · any warn → MEDIUM (HIGH if risk ≥ 40) · otherwise LOW
text  = "Risk 63/100 — HIGH. <every non-pass reason, worst first>"
```

## Buyer credit (`credit.ts`), separate from risk: "will the buyer pay?"
```
credit = 50 × on_time_rate + 25 × max(0, 1 − avg_delay_days/30) + 25 × max(0, 1 − outstanding/credit_limit)
no history (on_time_rate null) → same formula with on-time 0.5, delay 0, then capped at 60
```

## Decision (`decide.ts`)
any fail → **reject** · any warn, AI confidence < 0.8, credit < 70 or buyer dispute → **review** · otherwise
**auto_approve** (offer released only after the buyer confirms). Advance: credit ≥ 80 → 85%, 70–79 → 75%,
below 70 → suggested 65% (lender decides). Mock fee: 1.5% of the advance per started 30 days of tenor.

## Expected results (tests in `tests/engine.test.ts`; images in `samples/`)
| Sample | What it is | Risk | Decision |
|---|---|---|---|
| S1 `INV-1001` | Ravi → Peacock, 1,000 × ₹203.39 + 18% GST = ₹2,40,000; PO + receipt match | 0 LOW | auto-approve → buyer confirms → 85% = ₹2,04,000 (fee ₹6,120) |
| S2 | byte-identical copy of S1, after S1 is active | 60 HIGH | reject: same file + same number; PO already fully invoiced |
| S3 `INV-1002` | Ravi → Banyan, 100 drums billed, 80 delivered | 18 MEDIUM | review: +25% over delivered |
| S4 `KT-0042` | Kaveri Traders → Kaveri Retail, shared bank ••7788 | 15 HIGH | reject (credit 93 doesn't matter) |
| S5 `INV-0998` | Ravi → Banyan, clean, 300 dustbins ₹88,500 | 0 LOW | auto-approve → 75% = ₹66,375; tamper target |
| S6 `INV-1007` | S1 edited: number +1 char, total ₹2,46,000, bank ••9911 | 63 HIGH | reject: exceeds PO and PO used up; near-duplicate of INV-1001; bank changed; totals don't add up |
