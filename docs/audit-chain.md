# Hybrid audit chain

**Hybrid** = three stores with different jobs:
1. **Private documents:** invoice files in a private Storage bucket, full data in Postgres, visible only to the right roles.
2. **Tamper-evident log:** `audit_log`, where each entry holds hashes and a short summary, linked to the previous entry.
3. **Public commitment:** the Merkle root of each batch of entries, stored in `AnchorRegistry` on a blockchain
   (a local Hardhat chain for the hackathon). No documents, names or amounts ever go on-chain.

## Hashes (SHA-256, lowercase hex; `_shared/canon.ts`, `_shared/audit.ts`)
```
canon(x)     = JSON with keys sorted recursively, no whitespace         // same bytes every time
file_hash    = SHA256(file bytes)
record_hash  = SHA256(canon(invoice fields: id, supplier_id, buyer_id, invoice_no, invoice_date, due_date, vendor_name,
                            po_number, currency, subtotal, tax_amount, amount, bank_account, line_items, file_hash))
payload_hash = SHA256(canon({invoice_id, file_hash, record_hash, summary}))
entry_hash   = SHA256(prev_hash + event_type + payload_hash + ts)
prev_hash    = previous entry_hash; genesis = "0" × 64
```
- Money is hashed as fixed 2-decimal strings and the record is re-read from the DB before hashing, so Postgres number
  formatting can't cause false alarms. `ts` is stored as the exact ISO text that was hashed (not `timestamptz`).
- `status` is not in `record_hash`: it changes by design, and every change has its own audit event.
- Summaries never contain names or amounts, e.g. "20 checks: 19 pass, 1 warn · risk 18 MEDIUM".

## Events
`invoice_uploaded` · `fields_extracted` · `checks_completed` · `decision_made` · `buyer_confirmed` / `buyer_disputed` ·
`offer_released`.

## Writing (edge functions only, service role)
`appendAudit(invoice_id, event_type, summary)` reads the head, builds the entry and inserts it. `UNIQUE(prev_hash)`
makes two concurrent appends collide; the loser retries from the new head (up to 3 times). No client role has any
write privilege on `audit_log`.

## Verify (`verify-chain` → auditor screen)
| Someone… | Caught by | Message |
|---|---|---|
| edits an entry | recomputed payload or entry hash ≠ stored | "Entry #12 was changed after it was written" |
| deletes or reorders an entry | `prev_hash` ≠ previous entry's hash | "Entry #13 doesn't follow #11: an entry was removed or moved" |
| changes an invoice row | current `record_hash` ≠ the latest recorded one | "INV-0998 changed after entry #19: amount ₹88,500 → ₹8,85,000" |
| swaps the stored file | re-hashing the file ≠ recorded `file_hash` | "The file for INV-1001 is not the file that was uploaded" |
| rewrites the whole log consistently | recomputed batch root ≠ root anchored on-chain | "Batch #2 no longer matches its on-chain root (block 7)" |

Sequence gaps are not treated as deletions: a failed insert (e.g. the `prev_hash` race) burns an identity value.
The changed-field names come from `invoices.recorded_fields`, a convenience snapshot. The hash is the evidence.
`invoice-action` runs the record + file check again right before releasing an offer; a mismatch rejects the invoice.

## Merkle anchoring (`_shared/merkle.ts`, `chain/`)
- Leaves = `entry_hash` of the entries in the batch, in `seq` order. Parent = SHA256(left + right) on hex strings;
  an odd node is carried up unchanged. Root = the batch commitment.
- `npm --prefix chain run anchor`: signs in as the auditor, takes every entry after the last anchored batch, builds the
  root, calls `AnchorRegistry.anchor(root, fromSeq, toSeq)` on the local chain, then calls `record-anchor`, which
  recomputes the root from the DB and stores the batch (root, range, tx hash, block).
- `npm --prefix chain run verify`: for every batch compares the on-chain root, the stored root and a fresh root from
  the current DB entries. The auditor screen does the same on the anchor laptop (it can reach `127.0.0.1:8545`).
- A Merkle proof (sibling hashes) shows that one invoice's entry is inside an anchored batch without revealing the rest.
  Stretch: put it behind a QR code on approved invoices.

## Honest limits (say this in the pitch)
- A local Hardhat chain is ours, so it proves the mechanism, not independence. Production anchors the root on a public
  chain or a trusted timestamping service, which the database owner can't rewrite.
- Entries added after the last anchor are protected only by the hash chain until the next anchor. The head hash is
  always shown on the audit screen so an auditor can note it.

## Tamper demo (Supabase SQL editor, as the owner)
```sql
update invoices set amount = 885000 where invoice_no = 'INV-0998';   -- changed row (main demo)
update audit_log set payload = jsonb_set(payload, '{summary}', '"edited"') where seq = 5;  -- edited entry
delete from audit_log where seq = 7;                                   -- deleted entry
```
Press **Verify chain**. Undo with `supabase/demo_reset.sql` (clears invoices, checks, offers, audit log, anchors).
