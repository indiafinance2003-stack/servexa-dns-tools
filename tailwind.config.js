/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#e2e8f0',
        muted: '#94a3b8',
        line: '#1e293b',
        'navy-surface': '#111827',
        accent: '#2563eb',
        'accent-strong': '#1d4ed8',
        'accent-soft': '#38bdf8',
        'accent-tint': '#16294d',
        paper: '#0b1220',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
