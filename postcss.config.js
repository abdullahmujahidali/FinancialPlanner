// Tailwind 4 ships its PostCSS plugin separately and handles vendor prefixing
// itself, so autoprefixer is no longer needed.
module.exports = { plugins: { "@tailwindcss/postcss": {} } };
