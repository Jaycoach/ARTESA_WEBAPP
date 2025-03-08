// tailwind.config.js
export default {
    content: [
      './index.html',
      './src/**/*.{js,jsx}',
    ],
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