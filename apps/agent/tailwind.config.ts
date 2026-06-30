import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#7a1f2b',
          dark: '#5e1620',
          light: '#a8323f',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
