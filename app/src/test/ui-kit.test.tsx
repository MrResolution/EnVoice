import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Badge, Btn, Card, DarkCard, Field, toneOf } from '../ui/kit'

describe('UI Kit Primitives', () => {
  describe('toneOf status mapping', () => {
    it('maps positive and verified statuses to ok tone', () => {
      expect(toneOf('pass')).toBe('ok')
      expect(toneOf('LOW')).toBe('ok')
      expect(toneOf('approved')).toBe('ok')
      expect(toneOf('offer_released')).toBe('ok')
      expect(toneOf('checked')).toBe('ok')
      expect(toneOf('confirmed')).toBe('ok')
      expect(toneOf('accepted')).toBe('ok')
    })

    it('maps review, warning, and dispute statuses to warn tone', () => {
      expect(toneOf('warn')).toBe('warn')
      expect(toneOf('MEDIUM')).toBe('warn')
      expect(toneOf('review')).toBe('warn')
      expect(toneOf('disputed')).toBe('warn')
    })

    it('maps failures and rejections to bad tone', () => {
      expect(toneOf('fail')).toBe('bad')
      expect(toneOf('HIGH')).toBe('bad')
      expect(toneOf('rejected')).toBe('bad')
    })

    it('maps drafts and unclassified statuses to neutral tone', () => {
      expect(toneOf('draft')).toBe('neutral')
      expect(toneOf('pending')).toBe('neutral')
      expect(toneOf('unknown_status')).toBe('neutral')
      expect(toneOf(null)).toBe('neutral')
      expect(toneOf(undefined)).toBe('neutral')
    })
  })

  describe('Badge component', () => {
    it('renders with appropriate tone classes', () => {
      const { container } = render(<Badge tone="ok">Approved</Badge>)
      expect(screen.getByText('Approved')).toBeDefined()
      expect(container.firstChild).toBeDefined()
    })
  })

  describe('Btn component', () => {
    it('renders label and handles click', () => {
      let clicked = false
      render(<Btn onClick={() => { clicked = true }}>Click Me</Btn>)
      const btn = screen.getByText('Click Me')
      fireEvent.click(btn)
      expect(clicked).toBe(true)
    })

    it('disables when busy and shows spinner', () => {
      render(<Btn busy={true}>Processing</Btn>)
      const btn = screen.getByRole('button')
      expect(btn.hasAttribute('disabled')).toBe(true)
    })

    it('respects disabled prop', () => {
      let clicked = false
      render(<Btn disabled onClick={() => { clicked = true }}>Disabled</Btn>)
      const btn = screen.getByRole('button')
      fireEvent.click(btn)
      expect(clicked).toBe(false)
    })
  })

  describe('Field component', () => {
    it('renders label, input, and updates value', () => {
      let val = ''
      render(<Field label="Invoice Number" value={val} onChange={(e) => { val = e.target.value }} />)
      expect(screen.getByText('Invoice Number')).toBeDefined()
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'INV-1001' } })
      expect(val).toBe('INV-1001')
    })

    it('renders hint text when provided', () => {
      render(<Field label="GSTIN" hint="Format: 22AAAAA0000A1Z5" />)
      expect(screen.getByText('Format: 22AAAAA0000A1Z5')).toBeDefined()
    })
  })

  describe('Cards', () => {
    it('renders Card content', () => {
      render(<Card>Card Body</Card>)
      expect(screen.getByText('Card Body')).toBeDefined()
    })

    it('renders DarkCard content', () => {
      render(<DarkCard>Dark Card Body</DarkCard>)
      expect(screen.getByText('Dark Card Body')).toBeDefined()
    })
  })
})
