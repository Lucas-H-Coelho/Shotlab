/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#0f1115',
          card: '#161920',
          border: '#232834',
          accent: '#3b82f6',
          active: '#2563eb',
        }
      }
    },
  },
  plugins: [],
}
