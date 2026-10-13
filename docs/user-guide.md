# Invoseal user guide

Invoseal turns an unpaid invoice into cash today. A **seller** uploads an invoice their buyer will pay in 30–90 days,
the **buyer** confirms the goods arrived, and a **lender** advances up to 85% of it. AI reads the invoice, 21 written
rules decide, and every step is recorded in a tamper-evident audit chain anchored on a blockchain.

> Prototype for SYNESIS 26. Mock data only, no real money moves, not a licensed lender. No KYC, Aadhaar or PAN.

## Where to use it

| | |
|---|---|
| Android app | install `Invoseal.apk` (Drive/WhatsApp → open → allow install → "Install anyway") |
| Web (same app) | https://invoseal.vercel.app — sellers and buyers get the phone layout, lenders a dashboard |
| Sign in | **Continue with Google**, **Continue with email** (create an account), or a **demo account** |

Demo accounts (all `@invoseal.test`, one shared demo password kept by the team in `.env.local`):
`ravi`, `kaveri` (sellers) · `peacock`, `banyan` (buyers) · `lender` · `auditor`.

New accounts: after signing in you choose **I sell goods** or **I buy goods** and enter a business name, an optional
GSTIN, a bank account (made-up is fine) and a city. Two accounts with the same company email domain, GSTIN, bank account,
phone or address are flagged as possible self-dealing, so use different made-up details for seller and buyer.

---

## Seller (supplier) app

**Tabs:** Home · Invoices · ⬛ Scan (centre button) · Payouts · Profile

### Features
- **Home:** advances received (live), what is waiting with the lender and with the buyer, recent invoices.
- **Scan or upload:** take a photo or pick a PDF/JPEG/PNG/WebP up to 5 MB. Big photos are shrunk on the phone.
  The file is private; only you, the buyer on the invoice and the lender can open it (60-second links).
- **AI reading:** Gemini reads the invoice number, dates, PO number, amounts, GST, bank account and line items. If the
  AI is unavailable you type the fields; the lender sees that they were typed by hand.
- **Check the fields:** the document sits above the fields. Fix anything misread; an orange dot marks every field you
  change, and changes to the number, amounts or bank account are shown to the lender. Pick the buyer (matched
  automatically by GSTIN or name when possible).
- **21 checks, live:** after you submit, the checks tick through one by one, then you see:
  a risk gauge (0–100), the reason in plain English, a breakdown per check group, the three-way match
  (invoice vs purchase order vs delivery), and every check with its reason.
- **Progress:** Uploaded → Checked → Buyer OK → Offer. Updates arrive live when the buyer or lender acts.
- **Offer and accept:** when the buyer confirms, the advance appears (85% / 75% / 65% depending on the buyer's credit)
  with the fee explained. Tap **Accept** to take it (mock payout).
- **Payouts:** every advance, what you accepted, total fees.

### Script (2 minutes)
1. Sign in as **Ravi Plastics** (or create a seller account).
2. Tap the **centre scan button** → *Demo invoices* → **S1 · clean invoice** (or *Take a photo* of a real one).
3. Watch the scan: fingerprinting → uploading privately → AI reading the fields.
4. On **Check the fields**, tap the dark card to see the document, compare a few fields, tap **Submit for 21 checks**.
5. Watch the checks run. S1 shows **Risk 0 · LOW**, all checks passed, step **Checked**: waiting for Peacock Retail.
6. (After the buyer confirms) open the invoice again: **₹2,04,000 advance (85%)**, fee ₹6,120 → tap **Accept** → celebration.
7. Try **S6 · S1 with edits**: rejected, **Risk 63**: amount exceeds the PO, PO already used, looks like INV-1001
   (number differs by one character), bank account changed, totals don't add up.
8. Try **S3**: 100 billed but only 80 delivered (+25%) → goes to the lender for review.

---

## Buyer app

**Tabs:** Home · Orders · ⬛ New PO (centre button) · Invoices · Profile

### Features
- **Home:** payables you confirmed (live), your credit score and what it means for your suppliers' advances,
  open purchase orders, and **Needs your OK**.
- **Purchase orders:** pick a supplier, PO number, item, quantity, unit price and GST; the total is computed live.
  Invoices are matched against this PO.
- **Record delivery:** on a PO tap **Record delivery** and enter how many units arrived and when. Short deliveries are
  fine to record: an invoice for more than arrived is flagged for the lender.
- **Confirm an invoice:** the invoice is shown against your PO and your delivery record, with the bank account it
  pays into and the duplicate checks. **Confirm** releases the seller's advance; **Dispute** asks why
  (fewer goods, wrong price, damaged, never ordered) and sends it to the lender.
- You only ever see invoices raised on you, and only after the seller submits them.

### Script (2 minutes)
1. Sign in as **Peacock Retail** (or create a buyer account).
2. Centre button → **New purchase order** → choose a supplier, e.g. 1,200 × ₹32.50 at 18% GST → **Raise**.
3. **Orders** → **Record delivery** → 1,000 of 1,200 arrived → **Record delivery**.
4. When the seller submits an invoice on that PO it appears under **Needs your OK**.
5. Open **INV-1001** (from Ravi): quantity and price match PO-4501 and GRN-7001 → **Confirm**. Ravi's offer is released
   instantly.
6. Try **Dispute** on another invoice: choose a reason → it goes to the lender, who can then only reject it.

---

## Lender web dashboard

**Pages:** Review queue · Portfolio · Audit chain (sign in as `lender` on a laptop)

- **Key numbers:** advanced so far, needs review, waiting for buyers, blocked by rules (all live).
- **Queue ranked by risk** with filters (needs review, all, with buyer, released, rejected) and search.
- **Side panel:** risk gauge, the reason, risk breakdown, and **Approve x% / Reject**. Approval releases the advance
  once the buyer confirms. A disputed invoice can only be rejected.
- **Full invoice page:** match matrix, all checks, the document, and this invoice's audit trail.
- **Portfolio:** outstanding advances, fee income, and exposure by buyer (concentration risk).
- **Audit chain:** chain head hash, **Verify chain** (re-hashes every entry, every invoice record and every file),
  anchored batches and their on-chain roots, live entry list.

## Auditor
Read-only: **Audit chain** and **All invoices**. Tamper demo: change a row in the Supabase SQL editor
(`update invoices set amount = 885000 where invoice_no = 'INV-0998'`) → Verify turns red:
"INV-0998 changed after entry #N: amount ₹88,500 → ₹8,85,000".

---

## Rules in one screen
- Any **fail** (no PO, no delivery, over the PO, duplicate, self-dealing…) → **rejected**, whatever the score.
- Any **warning**, AI confidence below 80%, buyer credit below 70, or a dispute → **lender review**.
- Otherwise **checked** → buyer confirms → offer released.
- Advance: buyer credit 80+ → 85%, 70–79 → 75%, below 70 → 65% (lender decides). Fee (mock): 1.5% of the advance
  per started 30 days.

## Stage demo (4 minutes, two phones or phone + laptop)
1. **Seller phone (Ravi):** scan S1 → checks run → Risk 0.
2. **Buyer phone (Peacock):** confirm INV-1001 → **seller phone** shows ₹2,04,000 → Accept.
3. **Seller:** scan S6 → Risk 63, four reasons in plain English.
4. **Laptop (lender):** S3 at the top of the queue → 100 billed vs 80 delivered → Approve 75%.
5. **Laptop (auditor):** Verify → green → edit INV-0998 in SQL → Verify → red at the exact entry.
6. Wrap-up: AI reads, code decides, the chain proves it.

Before stage: run `supabase/demo_reset.sql`, then `npm --prefix chain run node` and `npm --prefix chain run anchor`
(see `docs/demo.md`).
