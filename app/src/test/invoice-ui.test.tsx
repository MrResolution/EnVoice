import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RiskRing, RiskBars } from '../ui/invoice'
import { Empty, ErrorNote, LogoMark } from '../ui/kit'
import type { InvoiceRow } from '../lib/data'

describe('Invoice Visualization Components', () => {
  describe('RiskRing', () => {
    it('renders with score and level in aria-label', () => {
      render(<RiskRing score={18} level="MEDIUM" />)
      expect(screen.getByText('18')).toBeDefined()
      expect(screen.getByText('MEDIUM RISK')).toBeDefined()
      const gauge = screen.getByRole('img')
      expect(gauge.getAttribute('aria-label')).toBe('Risk 18 out of 100, MEDIUM')
    })

    it('renders 0 LOW score', () => {
      render(<RiskRing score={0} level="LOW" dark />)
      expect(screen.getByText('0')).toBeDefined()
      expect(screen.getByText('LOW RISK')).toBeDefined()
    })
  })

  describe('RiskBars', () => {
    it('renders breakdown of weights and point contributions', () => {
      const mockInv = {
        risk_breakdown: [
          { category: 'integrity', label: 'File integrity', weight: 30, points: 0, status: 'pass', reasons: [] },
          { category: 'match', label: 'Three-way match', weight: 35, points: 18, status: 'warn', reasons: ['Quantity differs from delivered'] },
        ],
      } as unknown as InvoiceRow

      render(<RiskBars inv={mockInv} />)
      expect(screen.getByText(/File integrity/)).toBeDefined()
      expect(screen.getByText(/Three-way match/)).toBeDefined()
      expect(screen.getByText('pass')).toBeDefined()
      expect(screen.getByText('+18')).toBeDefined()
      expect(screen.getByText('Quantity differs from delivered')).toBeDefined()
    })
  })

  describe('Empty and Error States', () => {
    it('renders Empty state with title and message', () => {
      render(<Empty title="No invoices yet">Upload your first invoice to get started.</Empty>)
      expect(screen.getByText('No invoices yet')).toBeDefined()
      expect(screen.getByText('Upload your first invoice to get started.')).toBeDefined()
    })

    it('renders ErrorNote alert', () => {
      render(<ErrorNote>Failed to fetch data.</ErrorNote>)
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toBe('Failed to fetch data.')
    })

    it('renders LogoMark without error', () => {
      const { container } = render(<LogoMark size={48} />)
      expect(container.querySelector('svg')).toBeDefined()
    })
  })
})
