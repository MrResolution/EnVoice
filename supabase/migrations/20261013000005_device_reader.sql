-- The app can now read an invoice on the seller's device (Tesseract OCR) when the server's AI is unavailable.
-- That reading is the seller's own claim, so it gets its own source: checks send it to a person, and it is
-- never reused as "same file read before".
alter table public.invoices drop constraint invoices_ai_source_check;
alter table public.invoices add constraint invoices_ai_source_check check (ai_source in ('gemini', 'cache', 'reuse', 'ocr', 'manual'));
