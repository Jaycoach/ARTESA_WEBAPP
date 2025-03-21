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
        primary: '#687e8d',
        accent: '#f6db8e',
        secondary: '#f6754e',
        base: '#ffffff',
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