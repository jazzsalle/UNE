import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { primary: '#0a0e17', secondary: '#111827', tertiary: '#1f2937' },
        accent: { blue: '#3b82f6', cyan: '#06b6d4', green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444' },
        severity: { info: '#3b82f6', warning: '#f97316', critical: '#ef4444', emergency: '#dc2626' },
      },
    },
  },
  plugins: [],
};
export default config;
