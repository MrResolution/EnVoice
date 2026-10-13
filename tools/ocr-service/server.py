#!/usr/bin/env python3
"""
EnVoice Local GPU OCR / Document AI Microservice
Loads pretrained Donut / TrOCR invoice model from Hugging Face / Kaggle onto CUDA GPU.
Provides fast REST endpoint for invoice field extraction when Gemini API is unavailable.
"""

import io
import re
import sys
from typing import Any, Dict, List, Optional
import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import torch

app = FastAPI(title="EnVoice Pretrained Invoice Model Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_ID = "to-be/donut-base-finetuned-invoices"

processor = None
model = None


def load_model():
    global processor, model
    if model is not None:
        return
    from transformers import DonutProcessor, VisionEncoderDecoderModel
    print(f"[*] Loading pretrained invoice model '{MODEL_ID}' on {DEVICE}...")
    processor = DonutProcessor.from_pretrained(MODEL_ID)
    model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID).to(DEVICE, dtype=torch.float16 if DEVICE == "cuda" else torch.float32)
    model.eval()
    print(f"[✓] Model ready on {DEVICE}. VRAM allocated: {round(torch.cuda.memory_allocated() / (1024**2), 1)} MB" if DEVICE == "cuda" else f"[✓] Model ready on {DEVICE}.")


@app.on_event("startup")
def on_startup():
    try:
        load_model()
    except Exception as e:
        print(f"[!] Warning: model preload deferred: {e}", file=sys.stderr)


@app.get("/health")
def health():
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "None"
    vram_mb = round(torch.cuda.memory_allocated() / (1024**2), 1) if torch.cuda.is_available() else 0
    return {
        "status": "ok",
        "device": DEVICE,
        "gpu": gpu_name,
        "vram_mb": vram_mb,
        "model": MODEL_ID,
    }


def clean_num(s: Optional[str]) -> Optional[float]:
    if not s:
        return None
    cleaned = re.sub(r"[$€£₹,\s]", "", str(s))
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def clean_inv_no(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    raw = str(raw).strip()
    parts = raw.split("-")
    if len(parts) >= 2 and re.match(r"^[A-Za-z]+$", parts[0]):
        pfx = parts[0].upper()
        sfx = parts[1].replace("O", "0").replace("o", "0").replace("C", "0").replace("c", "0")
        sfx = sfx.replace("t", "1").replace("T", "1").replace("l", "1").replace("I", "1")
        sfx = sfx.replace("s", "5").replace("S", "5").replace("b", "8").replace("B", "8")
        return f"{pfx}-{sfx}"
    return raw


@app.post("/api/extract")
async def extract_invoice(file: UploadFile = File(...)):
    load_model()
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    # Resize image if excessively large to keep inference fast
    max_dim = max(image.width, image.height)
    if max_dim > 1600:
        scale = 1600 / max_dim
        image = image.resize((int(image.width * scale), int(image.height * scale)), Image.Resampling.LANCZOS)

    pixel_values = processor(image, return_tensors="pt").pixel_values.to(DEVICE, dtype=torch.float16 if DEVICE == "cuda" else torch.float32)
    task_prompt = "<s_cord-v2>"
    decoder_input_ids = processor.tokenizer(task_prompt, add_special_tokens=False, return_tensors="pt").input_ids.to(DEVICE)

    with torch.no_grad():
        outputs = model.generate(
            pixel_values,
            decoder_input_ids=decoder_input_ids,
            max_length=512,
            pad_token_id=processor.tokenizer.pad_token_id,
            eos_token_id=processor.tokenizer.eos_token_id,
            use_cache=True,
            num_beams=1,
            bad_words_ids=[[processor.tokenizer.unk_token_id]],
            return_dict_in_generate=True,
        )

    seq = processor.batch_decode(outputs.sequences)[0]
    seq = seq.replace(processor.tokenizer.eos_token, "").replace(processor.tokenizer.pad_token, "")
    seq = re.sub(r"<.*?>", "", seq, count=1).strip()

    parsed = {}
    try:
        parsed = processor.token2json(seq)
    except Exception:
        # Fallback manual regex tag parse
        tags = re.findall(r"<s_([^>]+)>\s*([^<]+)\s*</s_\1>", seq)
        for k, v in tags:
            parsed[k] = v.strip()

    # Normalize fields from Donut structure
    invoice_no = clean_inv_no(parsed.get("InvoiceNumber") or parsed.get("invoice_no") or parsed.get("inv_no"))
    amount = clean_num(parsed.get("GrossAmount") or parsed.get("total") or parsed.get("amount") or parsed.get("NetAmount1"))
    subtotal = clean_num(parsed.get("NetAmount1") or parsed.get("subtotal") or parsed.get("net_amount"))
    tax_amount = clean_num(parsed.get("TaxAmount1") or parsed.get("tax_amount") or parsed.get("vat_amount"))
    currency = parsed.get("Currency1") or parsed.get("currency") or "INR"
    po_number = parsed.get("OrderNumber") or parsed.get("po_number") or None
    invoice_date = parsed.get("DocumentDate") or parsed.get("invoice_date") or None

    if amount and subtotal and amount >= subtotal and not tax_amount:
        tax_amount = round(amount - subtotal, 2)

    return {
        "source": "donut",
        "device": DEVICE,
        "confidence": 0.92,
        "raw_parsed": parsed,
        "fields": {
            "invoice_no": invoice_no,
            "invoice_date": invoice_date,
            "due_date": None,
            "vendor_name": parsed.get("CreditorName") or None,
            "vendor_gstin": None,
            "buyer_name": parsed.get("DebtorName") or None,
            "buyer_gstin": None,
            "po_number": po_number,
            "currency": currency,
            "subtotal": subtotal,
            "tax_amount": tax_amount,
            "amount": amount,
            "bank_account": None,
            "line_items": [],
        },
    }


if __name__ == "__main__":
    print(f"[*] Starting EnVoice Pretrained Model OCR service on http://127.0.0.1:8000 ...")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
