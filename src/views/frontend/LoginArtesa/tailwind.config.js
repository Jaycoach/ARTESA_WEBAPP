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
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        slideIn: 'slideIn 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
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