import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    // The handoff's one responsive breakpoint is 900px, not Tailwind's default `md` (768px) —
    // use `oe:` for "desktop, >=900px" throughout instead of the built-in size names.
    screens: {
      oe: '900px',
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        bg: 'var(--oe-bg)',
        surface: 'var(--oe-surface)',
        surface2: 'var(--oe-surface-2)',
        raised: 'var(--oe-raised)',
        raised2: 'var(--oe-raised-2)',
        border: 'var(--oe-border)',
        border2: 'var(--oe-border-2)',
        border3: 'var(--oe-border-3)',
        'border-selected': 'var(--oe-border-selected)',
        text: 'var(--oe-text)',
        'text-secondary': 'var(--oe-text-secondary)',
        'text-muted': 'var(--oe-text-muted)',
        body: 'var(--oe-body)',
        action: 'var(--oe-action)',
        'action-hover': 'var(--oe-action-hover)',
        link: 'var(--oe-link)',
        link2: 'var(--oe-link-2)',
        green: 'var(--oe-green)',
        amber: 'var(--oe-amber)',
        red: 'var(--oe-red)',
        ig: 'var(--oe-ig)',
        ig2: 'var(--oe-ig-2)',
        label: 'var(--oe-label)',
        'amber-soft': 'var(--oe-amber-soft)',
        'border-hover': 'var(--oe-border-hover)',
      },
      borderRadius: {
        card: '7px',
        control: '5px',
      },
    },
  },
  plugins: [],
};

export default config;
