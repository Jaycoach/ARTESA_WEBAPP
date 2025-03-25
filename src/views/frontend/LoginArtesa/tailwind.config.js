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
        primary: '#687e8d',    // gris corporativo
        secondary: '#f6db8e',  // amarillo claro
        accent: '#f6754e',     // naranja
        base: '#ffffff',
        footer: '#d9d4ce',
        homePrimary: '#7b8ac0',
        secondaryHome: '#bbc4a6',
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