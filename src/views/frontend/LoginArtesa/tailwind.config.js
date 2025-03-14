/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.tsx',
    './src/**/*.{js,jsx,ts,tsx,html}',
  ],
  //darkMode: false,
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary-color)',
        secondary: 'var(--secondary-color)',
        accent: 'var(--accent-color)',
        hover: 'var(--hover-color)',
      },
      fontSize: {
        biggest: 'var(--biggestFontSize)',
        h1: 'var(--h1FontSize)',
        h2: 'var(--h2FontSize)',
        h3: 'var(--h3FontSize)',
        normal: 'var(--normalFontSize)',
      },
      borderRadius: {
        xl: 'var(--border-radius-xl)',
        '2xl': 'var(--border-radius-2xl)',
      },
    },
  },
  plugins: [],
};