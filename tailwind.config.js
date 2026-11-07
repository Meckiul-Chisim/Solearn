/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#17211B',
        paper: '#F7F6F0',
        forest: '#287A4B',
        coral: '#E7654D',
        gold: '#F2B84B',
      },
    },
  },
  plugins: [],
};
