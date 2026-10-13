// First sign-in (Google or email): the user picks seller or buyer and names their business.
// Creates their party and profile. No KYC: this is a prototype with made-up business details.
// Lender and auditor are never self-assigned; those accounts are seeded.

import { appendAudit, handleUser, HttpError, must } from '../_shared/db.ts'
import { digits, gstin } from '../_shared/normalize.ts'

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

handleUser(async (body, user, db) => {
  const existing = await db.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (existing.data) throw new HttpError(409, 'Your account is already set up.')

  const role = body.role === 'buyer' ? 'buyer' : body.role === 'supplier' ? 'supplier' : null
  if (!role) throw new HttpError(400, 'Choose whether you sell or buy goods.')
  const name = text(body.business_name, 80)
  if (name.length < 2) throw new HttpError(400, 'Enter your business name.')
  const g = gstin(text(body.gstin, 20))
  if (g && !/^[0-9]{2}[A-Z0-9]{13}$/.test(g)) throw new HttpError(400, 'A GSTIN has 15 letters and digits (or leave it empty).')
  const bank = digits(text(body.bank_account, 30))
  if (!bank || bank.length < 8 || bank.length > 18) throw new HttpError(400, 'Enter a bank account number (8 to 18 digits, made-up is fine).')

  const party = await must(db.from('parties').insert({
    type: role, name, gstin: g, bank_account: bank, city: text(body.city, 60) || null, owner_id: user.id,
    email: user.email, phone: text(body.phone, 20) || null, address: text(body.city, 60) || null,
    // New buyers have no payment history, so their credit is capped at 60 and a lender reviews their invoices.
    credit_limit: role === 'buyer' ? 1000000 : 0, on_time_rate: null, avg_delay_days: 0, outstanding: 0,
  }).select('id').single(), 'Business')
  await must(db.from('profiles').insert({
    id: user.id, role, party_id: party.id, full_name: text(body.full_name, 80) || user.name || name,
  }).select('id').single(), 'Profile')
  await appendAudit(db, { invoice_id: null, event_type: 'account_created', actor_id: user.id, summary: `${role} account created` })
  return { role, party_id: party.id }
})
