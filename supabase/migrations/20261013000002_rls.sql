-- Row-level security. Clients only ever SELECT; every write goes through an edge function (service role)
-- that checks the caller's role first. Privileges are revoked as well, so a missing policy can't open a hole.

create schema if not exists private;  -- not exposed through the API

-- Security definer so policies on profiles can read profiles without recursing. Both only describe the caller.
create function private.my_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;
create function private.my_party() returns uuid language sql stable security definer set search_path = '' as $$
  select party_id from public.profiles where id = (select auth.uid())
$$;
create function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('lender', 'auditor') from public.profiles where id = (select auth.uid())), false)
$$;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

alter table public.parties enable row level security;
alter table public.profiles enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.delivery_receipts enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_checks enable row level security;
alter table public.financing_offers enable row level security;
alter table public.audit_log enable row level security;
alter table public.anchors enable row level security;

-- Privileges: nothing for anon, read-only for signed-in users.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.purchase_orders, public.delivery_receipts, public.invoices,
  public.invoice_checks, public.financing_offers, public.audit_log, public.anchors to authenticated;
-- Identity and credit columns of parties stay server-side (self-dealing, bank and credit checks read them there).
grant select (id, type, name) on public.parties to authenticated;
-- Even the service role can't rewrite history. Only the database owner can (the tamper demo uses that on purpose).
revoke update, delete, truncate on public.audit_log, public.anchors from service_role;

create policy "parties: names are public to signed-in users" on public.parties
  for select to authenticated using (true);

create policy "profiles: own row, staff see all" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select private.is_staff()));

create policy "purchase orders: own side, staff see all" on public.purchase_orders
  for select to authenticated
  using ((select private.is_staff()) or supplier_id = (select private.my_party()) or buyer_id = (select private.my_party()));

-- Inherits the purchase_orders policy through the subquery.
create policy "delivery receipts: of visible POs" on public.delivery_receipts
  for select to authenticated using (exists (select 1 from public.purchase_orders p where p.id = po_id));

-- Buyers only see an invoice once the supplier has submitted it.
create policy "invoices: own, raised on me once submitted, staff see all" on public.invoices
  for select to authenticated
  using (
    (select private.is_staff())
    or supplier_id = (select private.my_party())
    or (buyer_id = (select private.my_party()) and status not in ('uploaded', 'extracted'))
  );

create policy "checks: of visible invoices" on public.invoice_checks
  for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id));

create policy "offers: of visible invoices" on public.financing_offers
  for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id));

create policy "audit log: staff only" on public.audit_log
  for select to authenticated using ((select private.is_staff()));

create policy "anchors: roots are public to signed-in users" on public.anchors
  for select to authenticated using (true);
