# 📦 InvoPay Sample Datasets & Demo Guide

This directory contains pre-generated, cryptographically consistent invoice documents (both **PNG** and **PDF**) and dataset records for end-to-end demonstrations and automated testing across multiple suppliers and buyers on InvoPay.

Every dataset is configured to achieve a **100% Three-Way Match** (Invoice ⟷ PO ⟷ Delivery GRN) and qualifies for an **85% advance offer** under standard financing rules.

---

## 📋 Standard Datasets (Ravi Plastics ⟷ Peacock Retail)

| Dataset | PO Number | Invoice Number | Item Description | Qty | Rate (₹) | Subtotal (₹) | GST 18% (₹) | Total (₹) | Advance (85%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DS-5101** | `PO-5101` | `INV-5101` | 20 L plastic bucket with lid | 500 | 200.00 | 1,00,000 | 18,000 | **1,18,000** | ₹1,00,300 |
| **DS-5102** | `PO-5102` | `INV-5102` | 50 L industrial storage drum | 200 | 500.00 | 1,00,000 | 18,000 | **1,18,000** | ₹1,00,300 |
| **DS-5103** | `PO-5103` | `INV-5103` | 12 L pedal dustbin | 400 | 250.00 | 1,00,000 | 18,000 | **1,18,000** | ₹1,00,300 |
| **DS-5104** | `PO-5104` | `INV-5104` | Heavy-duty plastic crate 40L | 300 | 400.00 | 1,20,000 | 21,600 | **1,41,600** | ₹1,20,360 |
| **DS-5105** | `PO-5105` | `INV-5105` | 10 L water dispenser container | 600 | 150.00 | 90,000 | 16,200 | **1,06,200** | ₹90,270 |
| **DS-8801** | `PO-8801` | `INV-8801` | Heavy duty container 50L | 100 | 500.00 | 50,000 | 9,000 | **59,000** | ₹50,150 |

---

## 🌟 Diverse Scenarios (Different Buyers, Suppliers, Multi-Line Items & Industries)

These 5 additional datasets showcase different business domains, multiple line items, distinct suppliers, and alternative buyers across the system:

| Dataset | Seller / Supplier | Buyer | PO / Invoice | Items & Details | Subtotal (₹) | Total with GST (₹) | Advance (85%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DS-6201** | **Ravi Plastics** (`ravi@invopay`) | **Banyan Stores** (`banyan@invopay`) | `PO-6201`<br>`INV-6201` | **Multi-line item order:**<br>• 250 × 30L Plastic bins @ ₹300<br>• 150 × Storage organizers @ ₹500 | 1,50,000 | **1,77,000** | ₹1,50,450 |
| **DS-6202** | **Ravi Plastics** (`ravi@invopay`) | **Lotus Wholesale** (`lotus@invopay`) | `PO-6202`<br>`INV-6202` | **Chemical packaging:**<br>• 120 × 200L UN-certified drums @ ₹1,500 | 1,80,000 | **2,12,400** | ₹1,80,540 |
| **DS-6203** | **Ravi Plastics** (`ravi@invopay`) | **Newleaf Foods** (`newleaf@invopay`) | `PO-6203`<br>`INV-6203` | **Agriculture/Food-grade crates:**<br>• 800 × Perforated harvest crates @ ₹175 | 1,40,000 | **1,65,200** | ₹1,40,420 |
| **DS-6204** | **Kaveri Traders** (`kaveri@invopay`) *(Different Supplier!)* | **Peacock Retail** (`peacock@invopay`) | `PO-6204`<br>`INV-6204` | **Metal fixtures & display racks:**<br>• 80 × 5-Shelf Steel display racks @ ₹2,500 | 2,00,000 | **2,36,000** | ₹2,00,600 |
| **DS-6205** | **Ravi Plastics** (`ravi@invopay`) | **Kaveri Retail** (`kaveri_retail@invopay`) | `PO-6205`<br>`INV-6205` | **Logistics export pallets:**<br>• 150 × HDPE 4-way heavy export pallets @ ₹1,800 | 2,70,000 | **3,18,600** | ₹2,70,810 |

---

## 🛠️ Step-by-Step Testing Walkthrough

Follow these 4 steps to run a complete invoice financing lifecycle:

### Step 1: Buyer Raises the Purchase Order (PO)
1. Sign in as the designated Buyer (e.g. **Peacock Retail** `peacock@invopay` or **Banyan Stores** `banyan@invopay`).
2. Go to **Orders** → **New purchase order** (`/b/orders/new`).
3. Select Supplier (e.g. **Ravi Plastics** `ravi@invopay` or **Kaveri Traders** `kaveri@invopay`).
4. Enter the PO Number, items, quantity, rate, and tax.
5. Tap **Raise purchase order**.

### Step 2: Buyer Records Delivery (GRN)
1. On the Buyer Orders screen, locate the PO.
2. Tap **Record delivery**.
3. Confirm delivered quantity matches the order.
4. Tap **Save delivery receipt** (generates GRN).

### Step 3: Seller Uploads the Invoice
1. Sign in as the matching Seller (**Ravi Plastics** or **Kaveri Traders**).
2. Go to **Upload Invoice** (`/s/upload`).
3. Either:
   - **Upload File:** Select the matching `.png` or `.pdf` from the `samples/` directory.
   - **Use Sample Invoices button:** Pick the invoice directly from the in-app sample picker.
   - **Create Manually:** Tap **Create manually / Quick match** and choose the active PO.
4. Review extracted fields on the Review screen.
5. Tap **Submit invoice for 21 automated checks**.

### Step 4: Verification & Payout
1. The 21 automated fraud, duplicate, and three-way match checks execute.
2. Three-way match succeeds (**Invoice amount = PO total = Delivered total**).
3. Switch to Buyer to tap **Confirm & Release Advance**.
4. Switch to Seller to tap **Accept Advance**.
5. All actions are cryptographically hashed and chained into the hybrid audit tree.

---

## 📁 Sample File Assets

- **Invoice Images (PNG):**
  - [`INV-5101.png`](./INV-5101.png) · 20L Buckets
  - [`INV-5102.png`](./INV-5102.png) · Storage Drums
  - [`INV-5103.png`](./INV-5103.png) · Pedal Dustbins
  - [`INV-5104.png`](./INV-5104.png) · Plastic Crates
  - [`INV-5105.png`](./INV-5105.png) · Water Containers
  - [`INV-8801.png`](./INV-8801.png) · Heavy Duty Container
  - [`INV-6201.png`](./INV-6201.png) · Multi-Item Storage Bins (Banyan Stores)
  - [`INV-6202.png`](./INV-6202.png) · Industrial Chemical Drums (Lotus Wholesale)
  - [`INV-6203.png`](./INV-6203.png) · Food-Grade Harvest Crates (Newleaf Foods)
  - [`INV-6204.png`](./INV-6204.png) · Steel Display Racks (Kaveri Traders → Peacock Retail)
  - [`INV-6205.png`](./INV-6205.png) · Heavy Duty Export Pallets (Kaveri Retail)
- **Invoice Documents (PDF):**
  - [`INV-5101.pdf`](./INV-5101.pdf)
  - [`INV-5102.pdf`](./INV-5102.pdf)
  - [`INV-5103.pdf`](./INV-5103.pdf)
  - [`INV-5104.pdf`](./INV-5104.pdf)
  - [`INV-5105.pdf`](./INV-5105.pdf)
  - [`INV-8801.pdf`](./INV-8801.pdf)
  - [`INV-6201.pdf`](./INV-6201.pdf)
  - [`INV-6202.pdf`](./INV-6202.pdf)
  - [`INV-6203.pdf`](./INV-6203.pdf)
  - [`INV-6204.pdf`](./INV-6204.pdf)
  - [`INV-6205.pdf`](./INV-6205.pdf)
- **Adversarial / Test Samples:**
  - `S1-clean.png` · Clean reference invoice
  - `S2-duplicate.png` · Exact byte duplicate check
  - `S3-mismatch.png` · Amount / PO quantity mismatch check
  - `S4-self-dealing.png` · Seller & Buyer circular ownership check
  - `S5-tamper-target.png` & `S6-edited-copy.png` · Perceptual hash tamper test
- **Machine-Readable Metadata:**
  - [`DATASETS.json`](./DATASETS.json)
  - [`manifest.json`](./manifest.json)
  - [`world.json`](./world.json)
