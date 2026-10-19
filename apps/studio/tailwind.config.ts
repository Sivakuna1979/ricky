import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08080b',
          900: '#0e0e13',
          850: '#13131a',
          800: '#191921',
          700: '#24242f',
          600: '#33333f',
          500: '#4a4a58',
        },
        fg: { DEFAULT: '#ededf2', 2: '#b9b9c6', 3: '#85859a', 4: '#5f5f72' },
        accent: { DEFAULT: '#8b5cf6', strong: '#7c3aed', soft: '#8b5cf61f' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
