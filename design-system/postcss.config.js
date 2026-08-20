module.exports = {
  plugins: {
    // MUST precede tailwindcss so @import is inlined before
    // Tailwind processes @tailwind/@layer directives.
    'postcss-import': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
