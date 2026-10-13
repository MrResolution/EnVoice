import sys
sys.path.append("tools")
from make_samples import draw_invoice, dhash
import json, hashlib
from pathlib import Path
from PIL import Image

world = json.loads(Path("samples/world.json").read_text())
parties = {p["key"]: p for p in world["parties"]}

ravi = parties["ravi"]
kaveri = parties["kaveri"]
peacock = parties["peacock"]
banyan = parties["banyan"]
lotus = parties["lotus"]
newleaf = parties["newleaf"]
kaveri_retail = parties["kaveri_retail"]

new_invoices = [
    {
        "id": "DS-6201",
        "num": "INV-6201",
        "po": "PO-6201",
        "supplier_obj": ravi,
        "buyer_obj": banyan,
        "title": "INV-6201 · Multi-Item Storage Bins",
        "inv_date": "2026-10-11",
        "due_date": "2026-12-10",
        "grn": "GRN-9201",
        "del_date": "2026-10-10",
        "subtotal": 150000.0,
        "tax": 27000.0,
        "total": 177000.0,
        "advance_pct": 85,
        "advance_amount": 150450.0,
        "fee_amount": 2655.0,
        "line_items": [
            {
                "description": "Heavy-duty plastic bin 30L",
                "hsn": "3923",
                "qty": 250,
                "unit_price": 300.0,
                "amount": 75000.0
            },
            {
                "description": "Modular storage organizer",
                "hsn": "3924",
                "qty": 150,
                "unit_price": 500.0,
                "amount": 75000.0
            }
        ]
    },
    {
        "id": "DS-6202",
        "num": "INV-6202",
        "po": "PO-6202",
        "supplier_obj": ravi,
        "buyer_obj": lotus,
        "title": "INV-6202 · Industrial Chemical Drums",
        "inv_date": "2026-10-10",
        "due_date": "2026-12-09",
        "grn": "GRN-9202",
        "del_date": "2026-10-09",
        "subtotal": 180000.0,
        "tax": 32400.0,
        "total": 212400.0,
        "advance_pct": 85,
        "advance_amount": 180540.0,
        "fee_amount": 3186.0,
        "line_items": [
            {
                "description": "200 L industrial chemical drum UN-certified",
                "hsn": "3923",
                "qty": 120,
                "unit_price": 1500.0,
                "amount": 180000.0
            }
        ]
    },
    {
        "id": "DS-6203",
        "num": "INV-6203",
        "po": "PO-6203",
        "supplier_obj": ravi,
        "buyer_obj": newleaf,
        "title": "INV-6203 · Food-Grade Harvest Crates",
        "inv_date": "2026-10-09",
        "due_date": "2026-12-08",
        "grn": "GRN-9203",
        "del_date": "2026-10-08",
        "subtotal": 140000.0,
        "tax": 25200.0,
        "total": 165200.0,
        "advance_pct": 85,
        "advance_amount": 140420.0,
        "fee_amount": 2478.0,
        "line_items": [
            {
                "description": "Food-grade perforated harvest crate 35L",
                "hsn": "3923",
                "qty": 800,
                "unit_price": 175.0,
                "amount": 140000.0
            }
        ]
    },
    {
        "id": "DS-6204",
        "num": "INV-6204",
        "po": "PO-6204",
        "supplier_obj": kaveri,
        "buyer_obj": peacock,
        "title": "INV-6204 · Commercial Steel Display Racks",
        "inv_date": "2026-10-08",
        "due_date": "2026-12-07",
        "grn": "GRN-9204",
        "del_date": "2026-10-07",
        "subtotal": 200000.0,
        "tax": 36000.0,
        "total": 236000.0,
        "advance_pct": 85,
        "advance_amount": 200600.0,
        "fee_amount": 3540.0,
        "line_items": [
            {
                "description": "Heavy-duty 5-shelf powder-coated steel display rack",
                "hsn": "9403",
                "qty": 80,
                "unit_price": 2500.0,
                "amount": 200000.0
            }
        ]
    },
    {
        "id": "DS-6205",
        "num": "INV-6205",
        "po": "PO-6205",
        "supplier_obj": ravi,
        "buyer_obj": kaveri_retail,
        "title": "INV-6205 · Heavy Duty Export Pallets",
        "inv_date": "2026-10-07",
        "due_date": "2026-12-06",
        "grn": "GRN-9205",
        "del_date": "2026-10-06",
        "subtotal": 270000.0,
        "tax": 48600.0,
        "total": 318600.0,
        "advance_pct": 85,
        "advance_amount": 270810.0,
        "fee_amount": 4779.0,
        "line_items": [
            {
                "description": "HDPE 4-way heavy duty export pallet 1200x1000mm",
                "hsn": "3923",
                "qty": 150,
                "unit_price": 1800.0,
                "amount": 270000.0
            }
        ]
    }
]

cache_path = Path("supabase/functions/_shared/sample-cache.json")
cache = json.loads(cache_path.read_text())

manifest_path = Path("samples/manifest.json")
manifest = json.loads(manifest_path.read_text())

datasets_json_path = Path("samples/DATASETS.json")
existing_datasets = json.loads(datasets_json_path.read_text())

brain_dir = Path("/Users/gowthamyuvaraj/.gemini/antigravity/brain/6b2c0844-4486-41d8-8c8b-d6f0b7d3ba68")

new_dataset_entries = []

for d in new_invoices:
    sup = d["supplier_obj"]
    byr = d["buyer_obj"]
    
    fields = {
        "invoice_no": d["num"],
        "invoice_date": d["inv_date"],
        "due_date": d["due_date"],
        "vendor_name": sup["name"],
        "vendor_gstin": sup["gstin"],
        "buyer_name": byr["name"],
        "buyer_gstin": byr["gstin"],
        "po_number": d["po"],
        "bank_account": sup["bank_account"],
        "subtotal": d["subtotal"],
        "tax_amount": d["tax"],
        "amount": d["total"],
        "currency": "INR",
        "line_items": d["line_items"]
    }
    
    png_path = Path(f"samples/{d['num']}.png")
    pdf_path = Path(f"samples/{d['num']}.pdf")
    app_png_path = Path(f"app/public/samples/{d['num']}.png")
    
    draw_invoice(png_path, fields, sup, byr, 0.0)
    draw_invoice(app_png_path, fields, sup, byr, 0.0)
    
    img = Image.open(png_path).convert("RGB")
    img.save(pdf_path, "PDF", resolution=150.0)
    img.save(brain_dir / f"{d['num']}.png")
    img.save(brain_dir / f"{d['num']}.pdf", "PDF", resolution=150.0)
    
    data_bytes = png_path.read_bytes()
    sha = hashlib.sha256(data_bytes).hexdigest()
    dh = dhash(png_path)
    
    cache[sha] = {**fields, "confidence": 0.99}
    
    manifest[d["num"]] = {
        "file": f"{d['num']}.png",
        "pdf": f"{d['num']}.pdf",
        "sha256": sha,
        "image_hash": dh,
        "bytes": len(data_bytes)
    }
    
    item_summary = ", ".join(l["description"] for l in d["line_items"])
    new_dataset_entries.append({
        "dataset_id": d["id"],
        "name": d["title"],
        "buyer": {
            "name": byr["name"],
            "upi_id": byr["key"] + "@invopay",
            "gstin": byr["gstin"]
        },
        "seller": {
            "name": sup["name"],
            "upi_id": sup["key"] + "@invopay",
            "gstin": sup["gstin"],
            "bank_account": sup["bank_account"]
        },
        "purchase_order": {
            "po_number": d["po"],
            "po_date": d["inv_date"],
            "item": item_summary,
            "hsn": d["line_items"][0]["hsn"],
            "qty": sum(l["qty"] for l in d["line_items"]),
            "unit_price": d["line_items"][0]["unit_price"],
            "subtotal": d["subtotal"],
            "tax_amount": d["tax"],
            "total": d["total"]
        },
        "delivery_receipt": {
            "grn_number": d["grn"],
            "qty_delivered": sum(l["qty"] for l in d["line_items"]),
            "delivered_on": d["del_date"]
        },
        "invoice": {
            "invoice_no": d["num"],
            "invoice_date": d["inv_date"],
            "due_date": d["due_date"],
            "files": {
                "png": f"samples/{d['num']}.png",
                "pdf": f"samples/{d['num']}.pdf"
            },
            "subtotal": d["subtotal"],
            "tax_amount": d["tax"],
            "amount": d["total"],
            "currency": "INR"
        },
        "financing": {
            "advance_pct": d["advance_pct"],
            "advance_amount": d["advance_amount"],
            "fee_amount": d["fee_amount"]
        }
    })
    print(f"Generated {d['num']} for {sup['name']} -> {byr['name']} (SHA: {sha[:10]}...)")

cache_path.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n")
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

all_datasets = existing_datasets + new_dataset_entries
datasets_json_path.write_text(json.dumps(all_datasets, indent=2) + "\n")

print("Generated 5 new diverse invoices, updated cache, manifest, and DATASETS.json successfully!")
