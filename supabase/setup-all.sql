-- Invoseal schema: 9 tables. Mock data only. See docs/schema.md.
-- Money is numeric(14,2) rupees. Dates the engine compares are `date`; audit `ts` is text (the exact string hashed).

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('supplier', 'buyer')),
  name text not null,
  gstin text,
  bank_account text,            -- the approved account
  ifsc text,
  phone text,
  email text,
  address text,
  credit_limit numeric(14,2) not null default 0,
  on_time_rate numeric(4,3) check (on_time_rate between 0 and 1),  -- null = no payment history
  avg_delay_days numeric(6,1) not null default 0,
  outstanding numeric(14,2) not null default 0,
  avg_invoice_amount numeric(14,2)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('supplier', 'buyer', 'lender', 'auditor')),
  party_id uuid references public.parties (id),
  full_name text not null,
  -- suppliers and buyers act for a company; lender and auditor see everything instead
  check ((role in ('supplier', 'buyer')) = (party_id is not null))
);
create index profiles_party_id_idx on public.profiles (party_id);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null,
  buyer_id uuid not null references public.parties (id),
  supplier_id uuid not null references public.parties (id),
  item text not null,
  hsn text,
  qty numeric(14,2) not null check (qty > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  tax_rate numeric(5,2) not null default 0,
  total numeric(14,2) not null check (total >= 0),
  po_date date not null,
  unique (buyer_id, po_number)
);
create index purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);

create table public.delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id),
  grn_number text not null,
  qty_delivered numeric(14,2) not null check (qty_delivered >= 0),
  delivered_on date not null,
  confirmed_by_buyer boolean not null default false
);
create index delivery_receipts_po_id_idx on public.delivery_receipts (po_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.parties (id),
  buyer_id uuid references public.parties (id),
  uploaded_by uuid not null references auth.users (id),
  -- lifecycle
  status text not null default 'uploaded'
    check (status in ('uploaded', 'extracted', 'checked', 'review', 'approved', 'rejected', 'offer_released')),
  buyer_status text not null default 'pending' check (buyer_status in ('pending', 'confirmed', 'disputed')),
  decision text check (decision in ('auto_approve', 'review', 'reject', 'approve')),
  decided_by text check (decided_by in ('engine', 'lender')),
  decision_reasons text[] not null default '{}',
  -- document
  file_path text not null unique,
  file_type text not null,
  file_size integer not null check (file_size > 0),
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  image_hash text check (image_hash ~ '^[0-9a-f]{16}$'),
  -- fields (normalised)
  invoice_no text,
  invoice_no_norm text,          -- look-alike-mapped number, set when the supplier submits
  invoice_date date,
  due_date date,
  vendor_name text,
  vendor_gstin text,
  buyer_name text,
  buyer_gstin text,
  po_number text,
  currency text,
  subtotal numeric(14,2),
  tax_amount numeric(14,2),
  amount numeric(14,2),
  bank_account text,
  line_items jsonb not null default '[]',
  qty numeric(14,2),
  -- AI
  ai_fields jsonb,
  ai_source text not null default 'manual' check (ai_source in ('gemini', 'cache', 'reuse', 'manual')),
  ai_confidence numeric(4,3),
  edited_fields text[] not null default '{}',
  -- results
  risk_score integer,
  risk_level text check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  risk_breakdown jsonb,
  risk_summary text,
  buyer_score integer,
  buyer_score_parts jsonb,
  advance_pct integer,
  buyer_note text,
  recorded_fields jsonb,         -- snapshot behind the latest record_hash; only explains a tamper, never evidence
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_supplier_id_idx on public.invoices (supplier_id);
create index invoices_buyer_id_idx on public.invoices (buyer_id);
create index invoices_file_hash_idx on public.invoices (file_hash);
create index invoices_status_idx on public.invoices (status);
-- Two *active* invoices can't share a number. Partial, so a rejected duplicate is still stored with its real number,
-- and the loser of two simultaneous submits gets 23505 (run-checks turns that into a duplicate rejection).
create unique index invoices_active_number_uq on public.invoices (supplier_id, buyer_id, invoice_no_norm)
  where status in ('checked', 'review', 'approved', 'offer_released');

create table public.invoice_checks (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position smallint not null,
  name text not null,
  category text not null check (category in ('three_way', 'duplicates', 'vendor_bank', 'integrity', 'behaviour')),
  status text not null check (status in ('pass', 'warn', 'fail')),
  reason text not null,
  detail jsonb                   -- match-matrix values
);
create index invoice_checks_invoice_id_idx on public.invoice_checks (invoice_id);

create table public.financing_offers (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.invoices (id) on delete cascade,
  lender_id uuid references public.profiles (id),   -- null = released automatically
  advance_pct integer not null check (advance_pct between 0 and 100),
  advance_amount numeric(14,2) not null,
  fee_amount numeric(14,2) not null,
  status text not null default 'released' check (status in ('released')),
  reasons text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.audit_log (
  seq bigint generated always as identity primary key,
  invoice_id uuid references public.invoices (id),
  event_type text not null check (event_type in ('invoice_uploaded', 'fields_extracted', 'checks_completed',
    'decision_made', 'buyer_confirmed', 'buyer_disputed', 'offer_released')),
  payload jsonb not null,
  payload_hash text not null,
  prev_hash text not null unique,  -- two concurrent appends collide here; the loser retries from the new head
  entry_hash text not null unique,
  ts text not null,                -- the exact ISO string that was hashed
  actor_id uuid references auth.users (id)
);
create index audit_log_invoice_id_idx on public.audit_log (invoice_id);

create table public.anchors (
  batch_no integer primary key,
  from_seq bigint not null,
  to_seq bigint not null,
  leaf_count integer not null check (leaf_count > 0),
  merkle_root text not null check (merkle_root ~ '^[0-9a-f]{64}$'),
  chain_id bigint not null,
  contract_address text not null,
  tx_hash text not null,
  block_number bigint not null,
  anchored_by uuid references auth.users (id),
  anchored_at timestamptz not null default now(),
  check (from_seq <= to_seq)
);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();

-- Live updates on the lists (Realtime applies RLS).
alter publication supabase_realtime add table public.invoices;
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
-- Private bucket for invoice files. Files are evidence: no update or delete for anyone.
-- Path: {supplier_party_id}/{uuid}.{ext}. Clients read through 60-second signed URLs only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "invoices bucket: suppliers upload into their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and (select private.my_role()) = 'supplier'
    and (storage.foldername(name))[1] = (select private.my_party())::text
  );

-- The owner supplier sees its folder; buyers and staff see a file through the invoice they can see (invoices RLS).
create policy "invoices bucket: owner, the invoice's buyer, staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'invoices'
    and (
      (storage.foldername(name))[1] = (select private.my_party())::text
      or exists (select 1 from public.invoices i where i.file_path = objects.name)
    )
  );
