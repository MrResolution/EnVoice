-- Re-assert "clients never write tables" (hard rules 3 and 5). On 13 Oct policies named "Allow public read/insert/
-- update on invoices" and ALL privileges for anon were added by hand in the SQL editor: anyone holding the public
-- anon key could read every invoice, change amounts or statuses, or truncate the table. This removes them and
-- resets every table to read-only for signed-in users. Safe to re-run.
drop policy if exists "Allow public insert on invoices" on public.invoices;
drop policy if exists "Allow public read on invoices" on public.invoices;
drop policy if exists "Allow public update on invoices" on public.invoices;
drop policy if exists "Allow public delete on invoices" on public.invoices;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.purchase_orders, public.delivery_receipts, public.invoices,
  public.invoice_checks, public.financing_offers, public.audit_log, public.anchors to authenticated;
grant select (id, type, name, city) on public.parties to authenticated;
revoke update, delete, truncate on public.audit_log, public.anchors from service_role;
