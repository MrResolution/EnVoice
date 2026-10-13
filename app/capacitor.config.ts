import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'test.invoseal.app',
  appName: 'Invoseal',
  webDir: 'dist',
  backgroundColor: '#f2f4f5', // no white flash before the web view paints
}
export default config
