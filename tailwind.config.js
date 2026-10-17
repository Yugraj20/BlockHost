/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bh: {
          bg: 'var(--bh-bg)',
          panel: 'var(--bh-panel)',
          card: 'var(--bh-card)',
          border: 'var(--bh-border)',
          text: 'var(--bh-text)',
          muted: 'var(--bh-muted)',
          accent: 'var(--bh-accent)',
          accentHover: 'var(--bh-accent-hover)',
          accentSubtle: 'var(--bh-accent-subtle)',
          accentBorder: 'var(--bh-accent-border)'
        }
      },
      boxShadow: {
        'accent-glow': 'var(--bh-accent-glow)',
        'premium': '0 10px 30px -5px rgba(0, 0, 0, 0.45), 0 0 0 1px var(--bh-border)'
      }
    }
  },
  plugins: []
}
