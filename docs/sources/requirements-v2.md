# Extra requirements from the team (13 Oct 2026, verbatim)

## 1. Invoice intake
User uploads an invoice as PDF or image.

Use a vision LLM to extract: vendor name, invoice number, date, amount, currency, tax, bank account, PO number, line items.

Show extracted fields beside the original document so judges can verify the extraction.

Normalize fields before comparison, e.g., "₹1,00,000" and "100000" become the same value.

## 2. Three-way match
Cross-check the invoice against

| Document         | What you verify                                           |
| ---------------- | --------------------------------------------------------- |
| Purchase order   | Vendor, PO number, approved amount, item descriptions     |
| Delivery receipt | Goods/services actually received, quantity, delivery date |
| Invoice          | Amount requested, invoice number, date, bank details      |

The system produces a match matrix:

Match: PO amount = invoice amount, delivery quantity = invoice quantity.

Warning: Minor mismatch, such as date gap or amount tolerance.

Fail: Invoice references a PO that does not exist, amount exceeds PO, or delivery is missing.

## 3. Duplicate and manipulation detection
Do not rely only on exact invoice-number matching. Fraudsters often change one character.

Use layered checks:

Exact duplicate: same invoice number + vendor + amount.

Near-duplicate: similar invoice number, amount, date, vendor, and line items.

File hash duplicate: identical PDF/image uploaded again.

Perceptual/image hash: same invoice image with visual edits.

Field-level anomaly: invoice amount changed after OCR, bank account changed, or vendor name slightly altered.

This matters because duplicate invoices are often resubmitted with small changes to invoice number, date, or amount.

## 4. Risk score
Give a transparent score from 0–100, not a black-box number.

Example:

| Check                  | Weight | Result  |
| ---------------------- | ------ | ------- |
| Three-way match        | 35     | Pass    |
| Duplicate check        | 25     | Pass    |
| Vendor/bank validation | 15     | Warning |
| Document integrity     | 15     | Pass    |
| Behavioral anomaly     | 10     | Fail    |

Then explain it:

Risk: 82/100 — HIGH. Invoice amount exceeds PO by ₹12,000; delivery receipt is missing; bank account differs from the
vendor's prior approved account.

That explanation is more impressive to judges than just "Fraud detected."

(Implementation note: this example doesn't add up. `docs/checks.md` defines the formula actually used.)

## 5. Blockchain: use it correctly
Do not put invoice PDFs, vendor data, or personal information on-chain. Put only cryptographic commitments on-chain.

Your architecture:

Store invoice files and extracted data in your app database or IPFS/local storage.

Compute a SHA-256 hash of each evidence record.

Build a hash chain locally.

Anchor only the Merkle root or periodic batch hash to a blockchain/smart contract.

A Merkle root lets you prove that a particular invoice record existed in a batch without publishing the whole document.
Hash-chained logs are tamper-evident, and anchoring the root externally adds independent proof that the log existed at a
point in time.

For the hackathon, use Hardhat/Anvil local chain. In production, you would anchor hashes to a public chain or trusted
timestamping service.

```
Frontend:  Invoice Upload • Extracted Fields • Risk Dashboard • Three-way Match • Audit Trail • Tamper Test • Lender View
   │ REST / WebSocket
Backend API:  Upload Service • Verification Engine • Risk Engine • Duplicate Detector • Audit Service • Financing Service
   ├── Object Store (invoice PDF, PO, delivery)
   ├── Application DB (vendors, POs / invoices, risk results)
   └── Vision LLM (field extraction, document checks)
Application DB → Evidence Hash Service (canonical JSON, SHA-256 file hashes, prev_hash → entry_hash)
  → Merkle Batch Builder (leaves = event hashes, root = batch commitment)
  → Local Blockchain (Hardhat / Anvil, AnchorRegistry contract stores Merkle root only)
```
