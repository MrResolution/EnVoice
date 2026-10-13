"""Draws the 6 sample invoices from samples/world.json, then writes:
- samples/manifest.json: file SHA-256 and 64-bit image hash per sample (used by tests)
- supabase/functions/_shared/sample-cache.json: file SHA-256 -> fields, so the demo works when Gemini is down

Run: tools/.venv/bin/python tools/make_samples.py   (needs Pillow)
All companies, GSTINs and bank numbers are mock data.
"""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "samples"
CACHE = ROOT / "supabase" / "functions" / "_shared" / "sample-cache.json"
W, H, M = 1240, 1754, 70  # A4 at 150 dpi, margin

INK, MUTED, LINE, SHADE = (20, 33, 51), (98, 110, 128), (205, 212, 222), (236, 241, 246)
FONT_DIR = Path("/System/Library/Fonts/Supplemental")


def has_rupee(path):
    """True if the font draws ₹ differently from a character it certainly lacks (its 'missing glyph' box)."""
    font = ImageFont.truetype(str(path), 24)

    def glyph(ch):
        img = Image.new("L", (40, 40))
        ImageDraw.Draw(img).text((5, 5), ch, font=font, fill=255)
        return img.tobytes()

    return glyph("₹") != glyph("￿")


# Prefer a font that has the rupee sign; otherwise print "Rs." like many real invoices do.
REG, BOLD = FONT_DIR / "Arial.ttf", FONT_DIR / "Arial Bold.ttf"
RUPEE = "₹" if has_rupee(REG) and has_rupee(BOLD) else "Rs."


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else REG), size)


def money(n):
    """Indian grouping: 240000.2 -> 2,40,000.20"""
    whole, frac = f"{abs(n):.2f}".split(".")
    head, tail = whole[:-3], whole[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ("-" if n < 0 else "") + ",".join(groups + [tail]) + "." + frac


ONES = "Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen".split()
TENS = "_ _ Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety".split()


def words(n):
    """Indian number words: 240000 -> Two Lakh Forty Thousand"""
    def below_100(x):
        return ONES[x] if x < 20 else TENS[x // 10] + ("" if x % 10 == 0 else " " + ONES[x % 10])

    def below_1000(x):
        h, rest = divmod(x, 100)
        return " ".join(p for p in [ONES[h] + " Hundred" if h else "", below_100(rest) if rest else ""] if p)

    parts = []
    for size, label in [(10_000_000, "Crore"), (100_000, "Lakh"), (1000, "Thousand")]:
        q, n = divmod(n, size)
        if q:
            parts.append(f"{below_1000(q)} {label}")
    if n:
        parts.append(below_1000(n))
    return " ".join(parts) or "Zero"


def nice_date(iso):
    y, m, d = iso.split("-")
    return f"{d}-{'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()[int(m) - 1]}-{y}"


def draw_invoice(path, f, supplier, buyer, round_off):
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    def text(x, y, s, size=22, bold=False, fill=INK, anchor="la"):
        d.text((x, y), s, font=font(size, bold), fill=fill, anchor=anchor)

    # Seller block (left) and invoice facts (right)
    text(M, 70, supplier["name"].upper(), 40, True)
    y = 125
    for line in [supplier["address"], f"GSTIN: {supplier['gstin']}", f"Phone: {supplier['phone']}  ·  {supplier['email']}"]:
        text(M, y, line, 21, fill=MUTED)
        y += 32
    text(W - M, 70, "TAX INVOICE", 34, True, anchor="ra")
    y = 125
    for label, value in [("Invoice No", f["invoice_no"]), ("Invoice Date", nice_date(f["invoice_date"])),
                         ("Due Date", nice_date(f["due_date"])), ("PO No", f["po_number"])]:
        text(W - M - 300, y, f"{label}:", 21, fill=MUTED)
        text(W - M, y, value, 21, True, anchor="ra")
        y += 32
    d.line([(M, 270), (W - M, 270)], fill=LINE, width=2)

    # Buyer block
    text(M, 295, "BILL TO", 18, True, fill=MUTED)
    text(M, 325, f["buyer_name"], 26, True)
    text(M, 362, buyer["address"], 21, fill=MUTED)
    text(M, 394, f"GSTIN: {f['buyer_gstin']}", 21, fill=MUTED)
    text(W - M, 325, "Place of supply: Tamil Nadu (33)", 21, fill=MUTED, anchor="ra")

    # Line items
    cols = [(M + 10, "#", "la"), (M + 60, "Description of goods", "la"), (690, "HSN", "la"),
            (860, "Qty", "ra"), (1010, f"Rate ({RUPEE})", "ra"), (W - M - 10, f"Amount ({RUPEE})", "ra")]
    top = 450
    d.rectangle([(M, top), (W - M, top + 48)], fill=SHADE)
    for x, label, anchor in cols:
        text(x, top + 13, label, 20, True, anchor=anchor)
    y = top + 70
    for i, li in enumerate(f["line_items"], 1):
        row = [str(i), li["description"], li["hsn"], f"{li['qty']:,}", money(li["unit_price"]), money(li["amount"])]
        for (x, _, anchor), value in zip(cols, row):
            text(x, y, value, 21, anchor=anchor)
        y += 44
    d.line([(M, y + 10), (W - M, y + 10)], fill=LINE, width=2)

    # Totals
    half = f["tax_amount"] / 2
    y += 40
    for label, value, bold in [("Taxable value", f["subtotal"], False), ("CGST @ 9%", half, False),
                               ("SGST @ 9%", half, False), ("Round off", round_off, False)]:
        text(800, y, label, 21, fill=MUTED)
        text(W - M - 10, y, money(value), 21, anchor="ra")
        y += 36
    d.rectangle([(780, y + 6), (W - M, y + 62)], fill=SHADE)
    text(800, y + 20, "TOTAL", 24, True)
    text(W - M - 10, y + 18, f"{RUPEE} {money(f['amount'])}", 28, True, anchor="ra")
    y += 100
    text(M, y, f"Amount in words: Rupees {words(int(round(f['amount'])))} Only", 21)

    # Bank details and footer
    y += 70
    text(M, y, "BANK DETAILS", 18, True, fill=MUTED)
    text(M, y + 30, f"Mock Bank Ltd  ·  A/c No: {f['bank_account']}  ·  IFSC: {supplier['ifsc']}", 21)
    text(W - M, H - 210, f"For {supplier['name']}", 21, True, anchor="ra")
    text(W - M, H - 130, "Authorised signatory", 20, fill=MUTED, anchor="ra")
    d.line([(M, H - 80), (W - M, H - 80)], fill=LINE, width=1)
    text(M, H - 60, "Mock invoice for the Invoseal hackathon prototype · not a real document · sample data only", 16, fill=MUTED)
    img.save(path, optimize=True)


def dhash(path):
    """64-bit difference hash: shrink to 9x8 grey, compare each pixel with its right neighbour.
    The app computes the same thing in a canvas (app/src/lib/image.ts)."""
    small = Image.open(path).convert("L").resize((9, 8), Image.Resampling.BOX)
    px = list(small.tobytes())  # mode "L": one byte per pixel
    bits = "".join("1" if px[r * 9 + c] < px[r * 9 + c + 1] else "0" for r in range(8) for c in range(8))
    return f"{int(bits, 2):016x}"


def main():
    world = json.loads((SAMPLES / "world.json").read_text())
    parties = {p["key"]: p for p in world["parties"]}
    by_key = {s["key"]: s for s in world["samples"]}
    manifest, cache = {}, {}
    for s in world["samples"]:
        path = SAMPLES / s["file"]
        if "copy_of" in s:
            shutil.copyfile(SAMPLES / by_key[s["copy_of"]]["file"], path)  # byte-identical: same SHA-256
            fields = by_key[s["copy_of"]]["fields"]
        else:
            fields = s["fields"]
            # An edited copy keeps the original's round-off line: the fraudster only retyped the total.
            base = by_key[s["edited_from"]]["fields"] if "edited_from" in s else fields
            round_off = round(base["amount"] - base["subtotal"] - base["tax_amount"], 2)
            draw_invoice(path, fields, parties[s["supplier"]], parties[s["buyer"]], round_off)
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest[s["key"]] = {"file": s["file"], "sha256": sha, "image_hash": dhash(path), "bytes": path.stat().st_size}
        cache[sha] = {**fields, "confidence": 0.97}
    (SAMPLES / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    CACHE.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n")
    print(f"rupee sign: {RUPEE}")
    for k, v in manifest.items():
        print(k, v["file"], v["sha256"][:12], v["image_hash"], f"{v['bytes'] // 1024} KB")


if __name__ == "__main__":
    main()
