import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { MobileShell } from '../ui/MobileShell'
import { DeskShell } from '../ui/DeskShell'
import * as Auth from '../lib/auth'

describe('Application Shells', () => {
  describe('MobileShell', () => {
    it('renders supplier tabs and action button', () => {
      render(
        <MemoryRouter initialEntries={['/s']}>
          <MobileShell role="supplier">
            <div>Supplier Content</div>
          </MobileShell>
        </MemoryRouter>
      )

      expect(screen.getByText('Supplier Content')).toBeDefined()
      expect(screen.getByText('Home')).toBeDefined()
      expect(screen.getByText('Invoices')).toBeDefined()
      expect(screen.getByText('Payouts')).toBeDefined()
      expect(screen.getByText('Profile')).toBeDefined()
      expect(screen.getByLabelText('Scan an invoice')).toBeDefined()
    })

    it('renders buyer tabs and action button', () => {
      render(
        <MemoryRouter initialEntries={['/b']}>
          <MobileShell role="buyer">
            <div>Buyer Content</div>
          </MobileShell>
        </MemoryRouter>
      )

      expect(screen.getByText('Buyer Content')).toBeDefined()
      expect(screen.getByText('Home')).toBeDefined()
      expect(screen.getByText('Orders')).toBeDefined()
      expect(screen.getByText('Invoices')).toBeDefined()
      expect(screen.getByText('Profile')).toBeDefined()
      expect(screen.getByLabelText('New purchase order')).toBeDefined()
    })
  })

  describe('DeskShell', () => {
    it('renders lender navigation and badges', () => {
      vi.spyOn(Auth, 'useAuth').mockReturnValue({
        session: null,
        profile: { id: 'l1', role: 'lender', party_id: null, full_name: 'Priya Sharma', party_name: 'Invoseal Capital', city: 'Mumbai', upi_id: 'priya@invoseal' },
        loading: false,
        refresh: async () => {},
        signOut: async () => {},
      })

      render(
        <MemoryRouter initialEntries={['/l']}>
          <DeskShell badge={3}>
            <div>Lender Workspace</div>
          </DeskShell>
        </MemoryRouter>
      )

      expect(screen.getByText('Lender Workspace')).toBeDefined()
      expect(screen.getByText('Review queue')).toBeDefined()
      expect(screen.getByText('Portfolio')).toBeDefined()
      expect(screen.getByText('Audit chain')).toBeDefined()
      expect(screen.getByText('3')).toBeDefined() // Badge count
      expect(screen.getByText('Invoseal Capital')).toBeDefined()
    })

    it('renders auditor navigation correctly', () => {
      vi.spyOn(Auth, 'useAuth').mockReturnValue({
        session: null,
        profile: { id: 'a1', role: 'auditor', party_id: null, full_name: 'Kiran Desai', party_name: 'EY Audit', city: 'Delhi', upi_id: 'kiran@invoseal' },
        loading: false,
        refresh: async () => {},
        signOut: async () => {},
      })

      render(
        <MemoryRouter initialEntries={['/a']}>
          <DeskShell>
            <div>Auditor Workspace</div>
          </DeskShell>
        </MemoryRouter>
      )

      expect(screen.getByText('Auditor Workspace')).toBeDefined()
      expect(screen.getByText('Audit chain')).toBeDefined()
      expect(screen.getByText('All invoices')).toBeDefined()
      expect(screen.getByText('EY Audit')).toBeDefined()
    })
  })
})
