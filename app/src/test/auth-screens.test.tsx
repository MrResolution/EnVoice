import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Welcome } from '../screens/auth/Welcome'
import * as OAuth from '../lib/oauth'

describe('Auth Screens', () => {
  describe('Welcome Screen', () => {
    it('renders hero title, value propositions, and auth controls', async () => {
      vi.spyOn(OAuth, 'googleEnabled').mockResolvedValue(true)

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      )

      expect(screen.getAllByText('Invoseal').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Peacock Retail/).length).toBeGreaterThan(0)
      expect(screen.getByText('Sign in')).toBeDefined()
    })
  })
})
