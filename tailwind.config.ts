import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'arc-red': '#ED1B2E',
        'arc-maroon': '#a51c30',
        'arc-maroon-dark': '#7a1424',
        'arc-black': '#1a1a1a',
        'arc-gray': {
          900: '#2d2d2d',
          700: '#4a4a4a',
          500: '#737373',
          300: '#a3a3a3',
          100: '#e5e5e5',
        },
        'arc-cream': '#f7f5f2',
        'arc-info': '#1e4a6d',
        'arc-success': '#2d5a27',
        'arc-caution': '#b8860b',
        'arc-alert': '#c41e3a',
      },
      fontFamily: {
        headline: ['"Libre Baskerville"', 'Georgia', 'serif'],
        body: ['"Source Sans Pro"', '"Helvetica Neue"', 'sans-serif'],
        data: ['"IBM Plex Mono"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
