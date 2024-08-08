/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        KoHo: ["KoHo", "sans-serif"],
      }
    },
  },
  plugins: ["prettier-plugin-tailwindcss"],
}

