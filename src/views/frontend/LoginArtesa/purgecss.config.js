module.exports = {
    content: [
      './src/**/*.html',
      './src/**/*.js',
      './src/**/*.jsx',
      './src/**/*.ts',
      './src/**/*.tsx',
      './src/**/*.vue'
    ],
    css: ['./src/assets/styles/App.scss'],
    safelist: [
      // Clases críticas que nunca deben eliminarse
      'active',
      'show',
      /^sidebar-/,
      /^icon-/
    ],
    // Extractor especial para clases con modificadores como hover:, md:, etc.
    defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
  }