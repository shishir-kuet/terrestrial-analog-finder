/** @type {import('tailwindcss').Config} */

// Semantic colour tokens. Components reference roles (surface, line, ink,
// accent) rather than raw palette steps, so the whole theme moves from the
// custom properties in index.css. The categorical series colours used by the
// charts live in src/lib/format.ts and are validated separately.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: token('bg'),
        surface: {
          DEFAULT: token('surface'),
          raised: token('surface-2'),
          sunken: token('surface-3'),
        },
        line: {
          DEFAULT: token('border'),
          strong: token('border-strong'),
        },
        ink: {
          DEFAULT: token('ink'),
          muted: token('ink-2'),
          faint: token('ink-3'),
        },
        accent: {
          DEFAULT: token('accent'),
          ink: token('accent-ink'),
          soft: token('accent-soft'),
        },
        warn: {
          DEFAULT: token('amber-ink'),
          soft: token('amber-soft'),
        },
        danger: token('rose-ink'),
        // Planetary body tints, used for badges, card edges and map keys.
        moon: token('body-moon'),
        mars: token('body-mars'),
        earth: token('body-earth'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // One spacing rhythm for section gaps, so pages align without ad-hoc margins.
      spacing: { section: '2.5rem', 'section-lg': '4rem' },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 32 / 0.04), 0 1px 3px rgb(16 24 32 / 0.06)',
        raised: '0 2px 4px rgb(16 24 32 / 0.04), 0 8px 24px -8px rgb(16 24 32 / 0.12)',
        pop: '0 4px 8px rgb(16 24 32 / 0.05), 0 16px 40px -12px rgb(16 24 32 / 0.18)',
      },
      maxWidth: { content: '72rem', prose: '46rem' },
    },
  },
  plugins: [],
};
