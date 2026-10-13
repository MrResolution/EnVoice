-- Self sign-up (Google or email) + buyer-raised purchase orders and deliveries + supplier accepting an offer.
-- Still no client writes: the onboard, orders and invoice-action functions do every insert after a role check.

-- Who created a party through onboarding (null = seeded). One business per account.
alter table public.parties add column owner_id uuid unique references auth.users (id) on delete set null;
alter table public.parties add column city text;

alter table public.purchase_orders add column created_by uuid references auth.users (id);
alter table public.purchase_orders add column created_at timestamptz not null default now();
alter table public.delivery_receipts add column created_by uuid references auth.users (id);
alter table public.delivery_receipts add column created_at timestamptz not null default now();
create unique index delivery_receipts_po_id_uq on public.delivery_receipts (po_id);  -- one delivery record per PO (prototype)
drop index if exists public.delivery_receipts_po_id_idx;

-- The supplier accepts the released offer (mock payout).
alter table public.financing_offers drop constraint financing_offers_status_check;
alter table public.financing_offers add constraint financing_offers_status_check check (status in ('released', 'accepted'));
alter table public.financing_offers add column accepted_at timestamptz;

-- New audit events: an order and a delivery are evidence too; accepting closes the loop.
alter table public.audit_log drop constraint audit_log_event_type_check;
alter table public.audit_log add constraint audit_log_event_type_check check (event_type in ('invoice_uploaded', 'fields_extracted',
  'checks_completed', 'decision_made', 'buyer_confirmed', 'buyer_disputed', 'offer_released', 'offer_accepted',
  'po_raised', 'delivery_recorded', 'account_created'));

-- Realtime for the lists that now change from the app.
alter publication supabase_realtime add table public.purchase_orders, public.financing_offers;

-- Column grants for the new columns (signed-in users read names and city only, as before).
grant select (city) on public.parties to authenticated;
