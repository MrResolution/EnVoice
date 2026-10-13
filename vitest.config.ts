import { defineConfig } from 'vitest/config'

// Engine tests run offline. RLS tests (tests/rls) hit the hosted Supabase project and read .env.local.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 } })
