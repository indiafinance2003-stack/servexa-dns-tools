/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        muted: '#475569',
        line: '#e2e8f0',
        accent: '#0f766e',
      },
    },
  },
  plugins: [],
};
