# Data model (9 tables)

All tables have RLS on. Ids are `uuid default gen_random_uuid()` unless noted. Money is `numeric(14,2)` rupees.

| Table | Key columns | Notes |
|---|---|---|
| `parties` | `type` (supplier/buyer), `name`, `gstin`, `bank_account` (the approved account), `phone`, `email`, `address`, `credit_limit`, `on_time_rate` (0–1, **null = no history**), `avg_delay_days`, `outstanding`, `avg_invoice_amount` | identity fields → self-dealing and bank checks; history → buyer credit; avg amount → behaviour check |
| `profiles` | `id` = `auth.users.id`, `role` (supplier/buyer/lender/auditor), `party_id`, `full_name` | role drives RLS and routing |
| `purchase_orders` | `po_number`, `buyer_id`, `supplier_id`, `item`, `hsn`, `qty`, `unit_price`, `tax_rate`, `total`, `po_date` | UNIQUE(buyer_id, po_number) |
| `delivery_receipts` | `po_id`, `grn_number`, `qty_delivered`, `delivered_on`, `confirmed_by_buyer` | receipts belong to the buyer side (seeded) |
| `invoices` | see below | partial UNIQUE(supplier_id, buyer_id, invoice_no_norm) WHERE status is active (checked · review · approved · offer_released) |
| `invoice_checks` | `invoice_id`, `name`, `category`, `status`, `reason`, `detail` jsonb (matrix values) | one row per check |
| `financing_offers` | `invoice_id` (unique), `lender_id`, `advance_pct`, `advance_amount`, `fee_amount`, `status`, `reasons` text[] | |
| `audit_log` | `seq` identity pk, `invoice_id`, `event_type`, `payload` jsonb, `payload_hash`, `prev_hash` (UNIQUE), `entry_hash` (UNIQUE), `ts` text, `actor_id` | append-only; `ts` is the exact ISO text that was hashed |
| `anchors` | `batch_no` pk, `from_seq`, `to_seq`, `leaf_count`, `merkle_root`, `chain_id`, `contract_address`, `tx_hash`, `block_number` | one row per anchored batch |

### `invoices` columns
- Lifecycle: `status` (uploaded · extracted · checked · review · approved · rejected · offer_released), `buyer_status`
  (pending · confirmed · disputed), `decision` (auto_approve · review · reject · approve), `decided_by` (engine · lender), `decision_reasons` text[] (the plain-English reasons shown on the invoice).
- Document: `file_path`, `file_type`, `file_size`, `file_hash` (SHA-256), `image_hash` (64-bit dHash, images only).
- Fields: `invoice_no`, `invoice_no_norm`, `invoice_date`, `due_date`, `vendor_name`, `vendor_gstin`, `buyer_name`,
  `buyer_gstin`, `po_number`, `currency`, `subtotal`, `tax_amount`, `amount`, `bank_account`, `line_items` jsonb
  (`[{description, hsn, qty, unit_price, amount}]`), `qty` (sum of line quantities).
- AI: `ai_fields` jsonb (what the model or cache returned), `ai_source` (gemini · cache · reuse · manual), `ai_confidence`,
  `edited_fields` text[].
- Results: `risk_score`, `risk_level`, `risk_breakdown` jsonb, `risk_summary`, `buyer_score`, `buyer_score_parts` jsonb,
  `advance_pct`, `buyer_note`, `recorded_fields` jsonb (snapshot used only to explain a tamper, never as evidence).

**Why the unique index is partial:** a rejected duplicate must still be stored (and audited) with its real invoice
number, and drafts don't count yet (`invoice_no_norm` is the look-alike-mapped number, set on submit). The index blocks two *active* invoices with the same number, so two simultaneous uploads can't both win:
the loser gets error 23505 and `run-checks` turns it into a duplicate rejection.

## Who can do what
Clients never insert, update or delete any table (privileges revoked as well as no policies). They upload files to
their own Storage folder and call edge functions, which use the service role after checking the caller's role.

| Table (select) | supplier | buyer | lender | auditor |
|---|---|---|---|---|
| profiles | own row | own row | all | all |
| parties | `id, type, name` of every party (column grant) | same | same | same |
| purchase_orders, delivery_receipts | own (supplier_id) | own (buyer_id) | all | all |
| invoices | own (supplier_id) | raised on them, once submitted | all | all |
| invoice_checks, financing_offers | of visible invoices | of visible invoices | all | all |
| audit_log | — | — | all | all |
| anchors | all (roots only) | all | all | all |

Identity and credit columns of `parties` are readable only by the service role; the lender sees credit through
`invoices.buyer_score_parts` and identity problems through check reasons (bank numbers masked to the last 4 digits).
Helpers `private.my_role()`, `private.my_party()`, `private.is_staff()` (security definer, stable, in a schema the API
doesn't expose) keep policies short. Even the service role has no UPDATE/DELETE on `audit_log` and `anchors`: only the
database owner can rewrite them, which is exactly what the tamper demo does in the SQL editor.

## Storage
Bucket `invoices`: private, 5 MB limit, PDF/JPEG/PNG/WebP only. Path `{supplier_party_id}/{uuid}.{ext}`.
Insert: suppliers, own folder only. Select: owner supplier, the invoice's buyer, lender, auditor.
No update or delete for anyone (files are evidence). Signed URLs last 60 seconds.

## RLS tests (`tests/rls.test.ts`, signs in as each demo user)
Allowed: Ravi reads own invoices · Peacock reads invoices raised on it · lender reads all · auditor reads audit_log.
**Denied:** Kaveri can't read or list Ravi's invoices · Kaveri can't sign a URL for Ravi's file · Banyan can't read
Peacock's invoice · supplier and buyer can't read audit_log · nobody can insert/update/delete any table (auditor
update invoice, supplier insert audit_log, lender delete audit_log) · supplier can't read parties' bank accounts ·
supplier can't upload into another supplier's folder.

## Seed world (`samples/world.json` → `supabase/seed.sql`)
Suppliers: **Ravi Plastics** (Coimbatore, approved bank ••4321) and **Kaveri Traders** (bank ••7788).

| Buyer | on-time | avg delay | outstanding / limit | Credit |
|---|---|---|---|---|
| Peacock Retail (excellent) | 98% | 1 d | ₹1L / ₹20L | 97 |
| Banyan Stores (average) | 84% | 6 d | ₹6L / ₹15L | 77 |
| Lotus Wholesale (slow) | 55% | 24 d | ₹9L / ₹10L | 35 |
| Newleaf Foods (brand-new) | — | — | ₹0 / ₹5L | 60 (cap) |
| Kaveri Retail (linked to Kaveri Traders) | 95% | 2 d | ₹1L / ₹10L | 93 |

POs and delivery receipts: PO-4501 (Peacock, 1,000 buckets, ₹2,40,000; 1,000 delivered), PO-4502 (Banyan, 100 drums,
₹59,000; **80 delivered**), PO-4503 (Kaveri Retail, 60 racks, ₹70,800), PO-4504 (Banyan, 300 dustbins, ₹88,500).

Demo users (`@invoseal.test`): ravi, kaveri (suppliers) · peacock, banyan (buyers) · lender · auditor.
They share one demo password stored in `.env.local` as `DEMO_PASSWORD` (git-ignored, mock accounts only).
