import type { Config } from 'tailwindcss'

/**
 * Design tokens — see docs/DESIGN_SYSTEM.md.
 * Signal colours (pos / neu / neg) are reserved for evidence ratings and are
 * always paired with an icon or label; they are never used as chart series colours.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#060a13',
          900: '#0a101d',
          850: '#0e1526',
          800: '#121b2f',
          750: '#17223a',
          700: '#1d2a45',
          600: '#2a3a5c',
          500: '#3b4d73',
        },
        fg: {
          DEFAULT: '#e8edf6',
          2: '#b4c0d6',
          3: '#7f8ea9',
          4: '#5b6a86',
        },
        accent: { DEFAULT: '#4c8dff', strong: '#2f74f0', soft: '#4c8dff1f' },
        pos: { DEFAULT: '#2fbf71', soft: '#2fbf711f' },
        neu: { DEFAULT: '#f0a93b', soft: '#f0a93b1f' },
        neg: { DEFAULT: '#ef5b5b', soft: '#ef5b5b1f' },
        series: { 1: '#3987e5', 2: '#d95926', 3: '#199e70', 4: '#c98500', 5: '#9085e9' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl: '0.875rem' },
      boxShadow: { card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 1px 2px rgba(0,0,0,0.25)' },
    },
  },
  plugins: [],
}

export default config
