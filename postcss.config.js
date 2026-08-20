module.exports = {
  plugins: {
    // MUST precede tailwindcss so @import inlines the design tokens.
    'postcss-import': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
