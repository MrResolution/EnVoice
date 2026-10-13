import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useDesktop } from '../lib/layout'
import { Icon } from '../ui/Icon'
import { Btn, Card, DarkCard } from '../ui/kit'
import { Page } from '../ui/motion'
import { TopBar } from '../ui/MobileShell'

export function Profile() {
  const { profile, session, signOut } = useAuth()
  const desktop = useDesktop()
  const [copied, setCopied] = useState(false)
  const role = profile?.role === 'buyer' ? 'Buyer' : profile?.role === 'lender' ? 'Lender' : profile?.role === 'auditor' ? 'Auditor' : 'Seller'
  const row = (label: string, value: string) => (
    <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="text-right text-sm font-bold text-ink">{value}</span>
    </div>
  )

  const copyId = () => {
    if (profile?.upi_id) {
      navigator.clipboard.writeText(profile.upi_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Page className="space-y-5">
      <TopBar title="Account profile" subtitle="Your registered organization and access details" />
      <div className={desktop ? 'max-w-3xl space-y-4' : 'space-y-3 px-[18px]'}>
        <DarkCard className="flex items-center gap-4 p-6" ringsAt="-right-10 -bottom-10 h-36 w-36">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-lime text-xl font-extrabold text-ink">
            {(profile?.party_name ?? profile?.full_name ?? '?').slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="text-2xl font-extrabold text-white">{profile?.party_name ?? profile?.full_name}</div>
            <div className="text-xs text-soft font-semibold">{role} account {profile?.city ? `· ${profile.city}` : ''}</div>
          </div>
        </DarkCard>

        {/* Unique Business InvoPay ID (like UPI ID) */}
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 border-2 border-lime/40 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-lime text-lg font-extrabold shadow-sm">
              @
            </span>
            <div>
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider">InvoPay Unique ID (UPI)</div>
              <div className="text-base font-extrabold text-ink font-mono">{profile?.upi_id ?? 'account@invopay'}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={copyId}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-ground px-3.5 py-2 text-xs font-bold text-ink hover:bg-line transition shadow-sm"
          >
            {copied ? <span className="text-ok font-bold">Copied ✓</span> : <span>Copy ID</span>}
          </button>
        </div>

        <Card className="px-5 py-2 border border-line">
          {row('InvoPay ID (UPI format)', profile?.upi_id ?? '—')}
          {row('Organization name', profile?.party_name ?? '—')}
          {row('Contact name', profile?.full_name ?? '—')}
          {row('City / Region', profile?.city ?? '—')}
          {row('Email address', session?.user.email ?? '—')}
          {row('Role authorization', `${role} Portal`)}
          {row('Authentication method', session?.user.app_metadata?.provider === 'google' ? 'Google OAuth 2.0' : 'Email / Password')}
        </Card>

        <Card className="flex gap-3 text-xs leading-relaxed text-muted border border-line p-4">
          <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-ink" />
          <span>
            <b>SYNESIS 26 Hackathon Prototype:</b> Mock data and transactions only. No real banking transfers or live lending licenses are represented. All original invoice documents are encrypted in private storage; only cryptographic SHA-256 hashes are recorded on the audit trail.
          </span>
        </Card>

        <div className="pt-2">
          <Btn kind="danger" icon="logout" className="w-full sm:w-auto" onClick={signOut}>
            Sign out of {profile?.party_name || 'Invoseal'}
          </Btn>
        </div>
      </div>
    </Page>
  )
}
