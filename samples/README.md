# 📦 InvoPay Sample Datasets & Demo Guide

This directory contains pre-generated, cryptographically consistent invoice documents (both **PNG** and **PDF**) and dataset records for end-to-end demonstrations and automated testing between:
- **Buyer:** Peacock Retail Pvt Ltd (`peacock@invopay`)
- **Seller:** Ravi Plastics (`ravi@invopay`)
- **Lender:** InvoPay Capital

Every dataset is configured to achieve a **100% Three-Way Match** (Invoice ⟷ PO ⟷ Delivery GRN) and qualifies for an **85% advance offer** under standard financing rules.

---

## 📋 Available Datasets Summary

| Dataset | PO Number | Invoice Number | Item Description | Qty | Rate (₹) | Subtotal (₹) | GST 18% (₹) | Total (₹) | Advance (85%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DS-5101** | `PO-5101` | `INV-5101` | 20 L plastic bucket with lid | 500 | 200.00 | 1,00,000 | 18,000 | **1,18,000** | ₹1,00,300 |
| **DS-5102** | `PO-5102` | `INV-5102` | 50 L industrial storage drum | 200 | 500.00 | 1,00,000 | 18,000 | **1,18,000** | ₹1,00,300 |
| **DS-5103** | `PO-5103` | `INV-5103` | 12 L pedal dustbin | 400 | 250.00 | 1,00,000 | 18,000 | **1,18,000** | ₹1,00,300 |
| **DS-5104** | `PO-5104` | `INV-5104` | Heavy-duty plastic crate 40L | 300 | 400.00 | 1,20,000 | 21,600 | **1,41,600** | ₹1,20,360 |
| **DS-5105** | `PO-5105` | `INV-5105` | 10 L water dispenser container | 600 | 150.00 | 90,000 | 16,200 | **1,06,200** | ₹90,270 |
| **DS-8801** | `PO-8801` | `INV-8801` | Heavy duty container 50L | 100 | 500.00 | 50,000 | 9,000 | **59,000** | ₹50,150 |

---

## 🛠️ Step-by-Step Testing Walkthrough

Follow these 4 steps to run a complete invoice financing lifecycle:

### Step 1: Buyer Raises the Purchase Order (PO)
1. Sign in as Buyer **Peacock Retail** (`peacock@invopay`).
2. Go to **Orders** → **New purchase order** (`/b/orders/new`).
3. Select Supplier: **Ravi Plastics (`ravi@invopay`)**.
4. Enter the details (e.g. for `DS-5101`):
   - **PO Number:** `PO-5101`
   - **Item:** `20 L plastic bucket with lid`
   - **Quantity:** `500`
   - **Unit Price:** `200`
   - **PO Date:** Today's date
5. Tap **Raise purchase order**.

### Step 2: Buyer Records Delivery (GRN)
1. On the Buyer Orders screen, locate `PO-5101`.
2. Tap **Record delivery**.
3. Confirm delivered quantity matches (`500`).
4. Tap **Save delivery receipt** (generates GRN).

### Step 3: Seller Uploads the Invoice
1. Sign in as Seller **Ravi Plastics** (`ravi@invopay`).
2. Go to **Upload Invoice** (`/s/upload`).
3. Either:
   - **Upload File:** Select `INV-5101.png` or `INV-5101.pdf` from the `samples/` directory.
   - **Use Sample Invoices button:** Pick `INV-5101` directly from the in-app picker.
   - **Create Manually:** Tap **Create manually / Quick match** and choose `PO-5101`.
4. Review extracted fields on the Review screen:
   - Notice the PO auto-matches `PO-5101`.
   - Buyer defaults to **Peacock Retail Pvt Ltd (`peacock@invopay`)**.
5. Tap **Submit invoice for 21 automated checks**.

### Step 4: Verification & Payout
1. The 21 automated fraud, duplicate, and three-way match checks execute.
2. Three-way match succeeds: **Invoice amount (₹1,18,000) = PO total (₹1,18,000) = Delivered total (500 units)**.
3. Switch to Buyer (`peacock@invopay`) to tap **Confirm & Release Advance**.
4. Switch to Seller (`ravi@invopay`) to tap **Accept Advance (₹1,00,300)**.
5. All actions are cryptographically hashed and chained into the hybrid audit tree.

---

## 📁 Sample File Assets

- **Invoice Images (PNG):**
  - [`INV-5101.png`](./INV-5101.png)
  - [`INV-5102.png`](./INV-5102.png)
  - [`INV-5103.png`](./INV-5103.png)
  - [`INV-5104.png`](./INV-5104.png)
  - [`INV-5105.png`](./INV-5105.png)
  - [`INV-8801.png`](./INV-8801.png)
- **Invoice Documents (PDF):**
  - [`INV-5101.pdf`](./INV-5101.pdf)
  - [`INV-5102.pdf`](./INV-5102.pdf)
  - [`INV-5103.pdf`](./INV-5103.pdf)
  - [`INV-5104.pdf`](./INV-5104.pdf)
  - [`INV-5105.pdf`](./INV-5105.pdf)
  - [`INV-8801.pdf`](./INV-8801.pdf)
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
