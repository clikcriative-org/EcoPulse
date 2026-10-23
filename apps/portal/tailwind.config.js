/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
      },
    },
  },
  plugins: [],
};
