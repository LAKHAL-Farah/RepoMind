import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dock: '#0D0B14',
        sidebar: '#161224',
        accent: '#7C3AED',
        'accent-light': '#A78BFA',
      },
      boxShadow: {
        glass: '0 18px 50px rgba(29, 21, 52, 0.14)',
        panel: '0 14px 36px rgba(15, 23, 42, 0.1)',
        glow: '0 0 0 1px rgba(124, 58, 237, 0.22), 0 20px 50px rgba(124, 58, 237, 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
