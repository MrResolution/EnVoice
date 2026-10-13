import { useAuth } from '../lib/auth'
import { Icon } from '../ui/Icon'
import { Btn, Card, DarkCard } from '../ui/kit'
import { Page } from '../ui/motion'
import { TopBar } from '../ui/MobileShell'

export function Profile() {
  const { profile, session, signOut } = useAuth()
  const role = profile?.role === 'buyer' ? 'Buyer' : 'Seller'
  const row = (label: string, value: string) => (
    <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line py-2 last:border-0"><span className="text-sm text-muted">{label}</span><span className="text-right text-[15px] font-semibold">{value}</span></div>
  )
  return (
    <Page>
      <TopBar title="Profile" />
      <div className="space-y-3 px-[18px]">
        <DarkCard className="flex items-center gap-4 p-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime text-lg font-extrabold text-ink">{(profile?.party_name ?? '?').slice(0, 2).toUpperCase()}</span>
          <div><div className="text-xl font-bold">{profile?.party_name}</div><div className="text-sm text-soft">{role} account{profile?.city ? ` · ${profile.city}` : ''}</div></div>
        </DarkCard>
        <Card className="px-4 py-1">
          {row('Name', profile?.full_name ?? '—')}
          {row('Signed in as', session?.user.email ?? '—')}
          {row('Sign-in method', session?.user.app_metadata?.provider === 'google' ? 'Google' : 'Email')}
        </Card>
        <Card className="flex gap-3 text-[13px] leading-relaxed text-ink-3">
          <Icon name="shield" size={20} className="mt-0.5 shrink-0" />
          <span>Prototype for the SYNESIS 26 hackathon: mock data only, no real money moves, not a licensed lender. Your documents stay private; only hashes go into the audit chain.</span>
        </Card>
        <Btn kind="light" icon="logout" className="w-full" onClick={signOut}>Sign out</Btn>
      </div>
    </Page>
  )
}
