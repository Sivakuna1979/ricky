import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Reuses tsconfig.json's "@/*" path mapping (tsconfigPaths) rather than
// hand-maintaining a second alias config that could drift from it.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
})
