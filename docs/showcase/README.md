# Invoseal — Product Showcase & Feature Gallery

A complete visual tour and component breakdown of **Invoseal** (Invoice Financing Platform with Hybrid Cryptographic Audit Architecture).

---

## Architecture & Product Roles

Invoseal provides dedicated workflows tailored to each participant in the invoice financing ecosystem:
1. **Suppliers / Sellers**: Fast invoice uploading, AI OCR extraction with manual override, real-time 3-way match tracking, and instant advance payouts.
2. **Buyers / Corporates**: Purchase Order management, Goods Received Notes (GRN) verification, and one-click invoice confirmation.
3. **Lenders / Financiers**: Automated risk-ranked review queue, 21-rule underwriting engine, deep-dive fraud detection, and portfolio risk management.
4. **Auditors & Compliance**: Cryptographic SHA-256 hash chains, Merkle tree batching, and on-chain verification against smart contracts.

---

## Complete Screenshot Catalog

### 1. Brand Experience & Public Entry

| Screenshot | Role / Route | Key Features Showcased |
|---|---|---|
| **[01_Landing_Hero_Desktop.png](./01_Landing_Hero_Desktop.png)** | Public (`/#/welcome`) | Desktop hero banner ("Cash today for invoices paid later"), core value propositions, feature pills, live demo invoice cards (INV-1001, Advance Released ₹2,04,000, 21 checks passed, Merkle verified), and judge demo accounts. |
| **[02_Landing_Hero_Mobile.png](./02_Landing_Hero_Mobile.png)** | Mobile (`/#/welcome`) | Responsive mobile-first PWA / Android landing experience with touch-optimized interactive showcase cards. |
| **[03_Auth_SignIn_and_DemoAccounts.png](./03_Auth_SignIn_and_DemoAccounts.png)** | Auth (`/#/auth/email`) | Clean sign-in interface supporting Google SSO, Email/Password, and expandable pre-seeded judge demo account switcher (Seller, Buyer, Lender, Auditor). |
| **[04_Auth_CreateAccount_Tab.png](./04_Auth_CreateAccount_Tab.png)** | Auth (`/#/auth/email`) | Account registration form with instant tab switching and client-side password validation. |

---

### 2. Supplier / Seller Portal (`/#/s`)

| Screenshot | Role / Route | Key Features Showcased |
|---|---|---|
| **[05_Supplier_Dashboard_Desktop.png](./05_Supplier_Dashboard_Desktop.png)** | Supplier (`/#/s`) | Executive dashboard for suppliers: 4-column KPI metrics (Advances Received ₹3,44,538, In review with lender, Awaiting buyer confirmation, Total invoices submitted), quick action buttons, and Recent Invoices table with live status and risk badges. |
| **[06_Supplier_Dashboard_Mobile.png](./06_Supplier_Dashboard_Mobile.png)** | Supplier Mobile (`/#/s`) | Mobile shell with bottom navigation bar, touch-friendly metric cards, and fast invoice action shortcuts. |
| **[07_Invoice_Upload_Zone.png](./07_Invoice_Upload_Zone.png)** | Supplier (`/#/s/upload`) | Upload zone supporting drag-and-drop, file browsing, and mobile camera capture. Displays privacy guarantee and client-side SHA-256 hash generation notice. |
| **[08_AI_OCR_Extraction_and_Verification.png](./08_AI_OCR_Extraction_and_Verification.png)** | Supplier (`/#/s/review/:id`) | Side-by-side OCR review interface: Original invoice image with cryptographic SHA-256 fingerprint displayed on the left; AI-extracted structured fields (Invoice #, Dates, PO #, GSTIN, line items, bank accounts, 97% confidence tag) on the right for verification. |
| **[09_Supplier_Invoices_Directory.png](./09_Supplier_Invoices_Directory.png)** | Supplier (`/#/s/invoices`) | Complete invoice directory filterable by tabs (`All`, `In progress`, `Offers`, `Rejected`) with real-time Supabase Realtime synchronization. |
| **[10_ThreeWay_Match_and_InvoiceDetail.png](./10_ThreeWay_Match_and_InvoiceDetail.png)** | Supplier (`/#/s/invoice/:id`) | Comprehensive invoice status view: Lifecycle stepper (`Uploaded → Checked → Buyer OK → Offer`), 3-way match validation matrix (Invoice vs PO vs Delivery Receipt), quantity check, unit price check, and "Accept advance ₹44,250" action button. |
| **[11_Supplier_Payouts_and_AdvanceHistory.png](./11_Supplier_Payouts_and_AdvanceHistory.png)** | Supplier (`/#/s/payouts`) | Disbursed advances summary (₹3,44,538 across 4 offers), 1.5% discount fee calculation, payout history table, and instant bank transfer status. |

---

### 3. Buyer / Corporate Portal (`/#/b`)

| Screenshot | Role / Route | Key Features Showcased |
|---|---|---|
| **[12_Buyer_Dashboard_Desktop.png](./12_Buyer_Dashboard_Desktop.png)** | Buyer (`/#/b`) | Buyer overview: Confirmed payables (₹4,33,520), Buyer credit score (60/100), Active purchase orders (2 fulfilled), and review queue of incoming supplier invoices. |
| **[13_Buyer_Dashboard_Mobile.png](./13_Buyer_Dashboard_Mobile.png)** | Buyer Mobile (`/#/b`) | Responsive mobile buyer layout with quick-action approval workflow. |
| **[14_Buyer_Purchase_Orders_Registry.png](./14_Buyer_Purchase_Orders_Registry.png)** | Buyer (`/#/b/orders`) | Purchase order directory showing PO-9101 and PO-9102, item quantities, unit prices, total contract value, and linked Goods Received Notes (GRN-9101, GRN-9102) delivery confirmation status. |
| **[15_Buyer_Create_New_Purchase_Order.png](./15_Buyer_Create_New_Purchase_Order.png)** | Buyer (`/#/b/orders/new`) | New PO form: Supplier selection pills, item description, quantity, unit price, 18% GST calculation card with dynamic total recalculation. |
| **[16_Buyer_Invoices_Awaiting_Approval.png](./16_Buyer_Invoices_Awaiting_Approval.png)** | Buyer (`/#/b/invoices`) | Invoices awaiting buyer approval with automated 3-way match validation status and "Review & Confirm" action triggers. |

---

### 4. Lender Underwriting & Risk Desk (`/#/l`)

| Screenshot | Role / Route | Key Features Showcased |
|---|---|---|
| **[17_Lender_Dashboard_and_RiskQueue.png](./17_Lender_Dashboard_and_RiskQueue.png)** | Lender (`/#/l`) | Risk-ranked queue: Invoices ordered from highest risk to lowest risk. Left side displays filterable table; right side features interactive risk inspector with composite risk gauge (63 HIGH RISK), plain-English explanations, and weighted risk scorecards. |
| **[18_Lender_Dashboard_Mobile.png](./18_Lender_Dashboard_Mobile.png)** | Lender Mobile (`/#/l`) | Compact mobile dashboard for lenders on the move with summary cards and touch-based queue navigation. |
| **[19_Lender_DeepDive_Invoice_Analysis.png](./19_Lender_DeepDive_Invoice_Analysis.png)** | Lender (`/#/l/invoice/:id`) | Underwriting deep-dive: Detailed 21 automated rule breakdown (Three-way match weight 35, Duplicates weight 25, Vendor/bank weight 15, Document integrity weight 15, Behaviour weight 10), fraud warning highlights, and financing decision actions. |
| **[20_Lender_Portfolio_and_Exposure.png](./20_Lender_Portfolio_and_Exposure.png)** | Lender (`/#/l/portfolio`) | Portfolio analytics: Outstanding advances (₹3,44,538), Platform fee income (₹10,336.14), Seller acceptance rate, and Concentration Risk by Buyer with interactive proportional progress bars (Peacock Retail 59%, Banyan Stores 32%, QA Mart 9%). |

---

### 5. Auditor & Hybrid Cryptographic Blockchain (`/#/l/chain` & `/#/a`)

| Screenshot | Role / Route | Key Features Showcased |
|---|---|---|
| **[21_Cryptographic_Audit_Chain_Explorer.png](./21_Cryptographic_Audit_Chain_Explorer.png)** | Audit (`/#/l/chain`) | Immutable audit trail: Current chain head hash (`19c39a63...`), live sequential entry log (#139 to #133) tracking uploads, AI extractions, rule checks, and decisions with predecessor hash linking. |
| **[22_Audit_Chain_Verification_Live.png](./22_Audit_Chain_Verification_Live.png)** | Audit (`/#/l/chain`) | Live cryptographic re-hashing verification in progress: Recomputes SHA-256 hashes for every file, DB record, and Merkle root to prove zero tampering. |
| **[23_Organization_Profile_Settings.png](./23_Organization_Profile_Settings.png)** | Profile (`/#/s/profile`) | Organization identity screen showing registered business name, role, verified GSTIN, bank account number, and session management. |

---

## Key Highlights for Pitch Decks & Product Presentations

1. **Dual Responsive Shells**: Desktop provides high-density split-screen dashboards with live side-by-side document comparison; Mobile provides a native app experience (wrapped via Capacitor for Android APK).
2. **21 Deterministic Rules Before Scoring**: Rejection is driven by strict deterministic checks (circular trading, bank account mismatch, duplicate hashes, PO quantity overrun) rather than opaque black-box AI scores.
3. **Hybrid On-Chain Proofs**: Private documents and financial data remain off-chain in private encrypted storage; only mathematical Merkle roots of audit batches are anchored to Ethereum/Hardhat smart contracts.
