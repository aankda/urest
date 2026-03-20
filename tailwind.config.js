/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#ced9fd',
          300: '#adc0fb',
          400: '#8ca7f9',
          500: '#6b8ef7',
          600: '#5672c6',
          700: '#415695',
          800: '#2c3964',
          900: '#171d33',
        },
      },
    },
  },
  plugins: [],
}
