-- Demo reset: run in the Supabase SQL editor (as the owner) before going on stage.
-- Clears everything the demo creates; keeps parties, POs, receipts and users.
-- Uploaded files stay in Storage (files are evidence and can't be deleted through SQL); new uploads get new paths.
-- After a reset, run `npm --prefix chain run anchor` again: old on-chain batches simply stop being referenced.
truncate public.financing_offers, public.invoice_checks, public.anchors, public.audit_log, public.invoices restart identity;
