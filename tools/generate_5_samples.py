import sys
sys.path.append("tools")
from make_samples import draw_invoice, dhash
import json, hashlib
from pathlib import Path
from PIL import Image

world = json.loads(Path("samples/world.json").read_text())
parties = {p["key"]: p for p in world["parties"]}
ravi = parties["ravi"]
peacock = parties["peacock"]

samples_data = [
    {
        "num": "INV-5101",
        "po": "PO-5101",
        "desc": "20 L plastic bucket with lid",
        "hsn": "3924",
        "qty": 500,
        "rate": 200.0,
        "subtotal": 100000.0,
        "tax": 18000.0,
        "total": 118000.0,
        "inv_date": "2026-10-11",
        "due_date": "2026-12-10",
        "grn": "GRN-8101",
        "del_date": "2026-10-10"
    },
    {
        "num": "INV-5102",
        "po": "PO-5102",
        "desc": "50 L industrial storage drum",
        "hsn": "3923",
        "qty": 200,
        "rate": 500.0,
        "subtotal": 100000.0,
        "tax": 18000.0,
        "total": 118000.0,
        "inv_date": "2026-10-11",
        "due_date": "2026-12-10",
        "grn": "GRN-8102",
        "del_date": "2026-10-09"
    },
    {
        "num": "INV-5103",
        "po": "PO-5103",
        "desc": "12 L pedal dustbin",
        "hsn": "3924",
        "qty": 400,
        "rate": 250.0,
        "subtotal": 100000.0,
        "tax": 18000.0,
        "total": 118000.0,
        "inv_date": "2026-10-10",
        "due_date": "2026-12-09",
        "grn": "GRN-8103",
        "del_date": "2026-10-08"
    },
    {
        "num": "INV-5104",
        "po": "PO-5104",
        "desc": "Heavy-duty plastic crate 40L",
        "hsn": "3923",
        "qty": 300,
        "rate": 400.0,
        "subtotal": 120000.0,
        "tax": 21600.0,
        "total": 141600.0,
        "inv_date": "2026-10-09",
        "due_date": "2026-12-08",
        "grn": "GRN-8104",
        "del_date": "2026-10-07"
    },
    {
        "num": "INV-5105",
        "po": "PO-5105",
        "desc": "10 L water dispenser container",
        "hsn": "3923",
        "qty": 600,
        "rate": 150.0,
        "subtotal": 90000.0,
        "tax": 16200.0,
        "total": 106200.0,
        "inv_date": "2026-10-08",
        "due_date": "2026-12-07",
        "grn": "GRN-8105",
        "del_date": "2026-10-06"
    }
]

cache_path = Path("supabase/functions/_shared/sample-cache.json")
cache = json.loads(cache_path.read_text())
brain_dir = Path("/Users/gowthamyuvaraj/.gemini/antigravity/brain/6b2c0844-4486-41d8-8c8b-d6f0b7d3ba68")

for d in samples_data:
    fields = {
        "invoice_no": d["num"],
        "invoice_date": d["inv_date"],
        "due_date": d["due_date"],
        "vendor_name": "Ravi Plastics",
        "vendor_gstin": "33ABCPR4821K1Z6",
        "buyer_name": "Peacock Retail Pvt Ltd",
        "buyer_gstin": "33AACCP5120D1Z9",
        "po_number": d["po"],
        "bank_account": "918020014321",
        "subtotal": d["subtotal"],
        "tax_amount": d["tax"],
        "amount": d["total"],
        "currency": "INR",
        "line_items": [
            {
                "description": d["desc"],
                "hsn": d["hsn"],
                "qty": d["qty"],
                "unit_price": d["rate"],
                "amount": d["subtotal"]
            }
        ]
    }
    png_path = Path(f"samples/{d['num']}.png")
    pdf_path = Path(f"samples/{d['num']}.pdf")
    draw_invoice(png_path, fields, ravi, peacock, 0.0)
    draw_invoice(Path(f"app/public/samples/{d['num']}.png"), fields, ravi, peacock, 0.0)

    img = Image.open(png_path).convert("RGB")
    img.save(pdf_path, "PDF", resolution=150.0)
    img.save(brain_dir / f"{d['num']}.png")
    img.save(brain_dir / f"{d['num']}.pdf", "PDF", resolution=150.0)
    
    sha = hashlib.sha256(png_path.read_bytes()).hexdigest()
    cache[sha] = {**fields, "confidence": 0.99}
    print(f"Generated {d['num']} (SHA: {sha[:10]}...)")

cache_path.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n")
print("All 5 invoices generated and cached successfully!")
