/** Alla färger går via CSS-variabler (se src/index.css) så att ljust/mörkt läge
 *  byts på ett ställe och hela gränssnittet håller ihop. */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: token('app'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        accent: token('accent'),
        laser: token('laser'),
        wood: token('wood'),
        ok: token('ok'),
        warn: token('warn'),
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI Variable Text"', '"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', '14px'],
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
      },
      boxShadow: {
        pop: '0 12px 32px -8px rgb(0 0 0 / 0.28), 0 0 0 1px rgb(var(--c-line) / 1)',
      },
    },
  },
  plugins: [],
};
