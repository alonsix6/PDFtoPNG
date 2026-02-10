/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#00FF85',
          'green-hover': '#00CC6A',
          violet: '#6F42C1',
          error: '#FF4444',
          warning: '#FFB800',
        },
        surface: {
          dark: '#1A1A1A',
          mid: '#2D2D2D',
          border: '#333333',
        },
        'text-secondary': '#888888',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['Montserrat', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
};
