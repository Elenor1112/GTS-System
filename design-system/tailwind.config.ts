import type { Config } from 'tailwindcss';

/**
 * GTS — Tailwind configuration.
 *
 * Tailwind here is a CONSUMER of the CSS custom properties in
 * tokens/*.css, never a second source of truth. Every value below
 * resolves to a var(), so theming (light/dark, per-domain accent)
 * happens in CSS at runtime and utilities inherit it for free.
 *
 * Tailwind's default palette, spacing and radius scales are
 * REPLACED (not extended) so an off-system value like `bg-blue-500`
 * or `rounded-2xl` simply does not exist and cannot drift in.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    // --- REPLACED scales (closed sets) ---------------------
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      page: 'var(--gts-bg-page)',
      surface: 'var(--gts-bg-surface)',
      raised: 'var(--gts-bg-raised)',
      sunken: 'var(--gts-bg-sunken)',
      inset: 'var(--gts-bg-inset)',
      hover: 'var(--gts-bg-hover)',
      selected: 'var(--gts-bg-selected)',
      inverse: {
        DEFAULT: 'var(--gts-bg-inverse)',
        raised: 'var(--gts-bg-inverse-raised)',
      },

      fg: {
        DEFAULT: 'var(--gts-fg-primary)',
        secondary: 'var(--gts-fg-secondary)',
        muted: 'var(--gts-fg-muted)',
        disabled: 'var(--gts-fg-disabled)',
        inverse: 'var(--gts-fg-inverse)',
        'inverse-muted': 'var(--gts-fg-inverse-muted)',
        'on-accent': 'var(--gts-fg-on-accent)',
      },

      line: {
        DEFAULT: 'var(--gts-border-default)',
        hairline: 'var(--gts-border-hairline)',
        strong: 'var(--gts-border-strong)',
        inverse: 'var(--gts-border-inverse)',
      },

      // Domain-aware: resolves per [data-domain] subtree.
      accent: {
        DEFAULT: 'var(--gts-accent)',
        bright: 'var(--gts-accent-bright)',
        wash: 'var(--gts-accent-wash)',
      },
      brand: {
        DEFAULT: 'var(--gts-brand)',
        fg: 'var(--gts-brand-fg)',
        bg: 'var(--gts-brand-bg)',
      },

      success: { DEFAULT: 'var(--gts-success-fg)', bg: 'var(--gts-success-bg)', br: 'var(--gts-success-br)' },
      warning: { DEFAULT: 'var(--gts-warning-fg)', bg: 'var(--gts-warning-bg)', br: 'var(--gts-warning-br)' },
      danger: { DEFAULT: 'var(--gts-danger-fg)', bg: 'var(--gts-danger-bg)', br: 'var(--gts-danger-br)' },
      info: { DEFAULT: 'var(--gts-info-fg)', bg: 'var(--gts-info-bg)', br: 'var(--gts-info-br)' },
      neutral: { DEFAULT: 'var(--gts-neutral-fg)', bg: 'var(--gts-neutral-bg)', br: 'var(--gts-neutral-br)' },

      domain: {
        finance: 'var(--gts-domain-finance)',
        inventory: 'var(--gts-domain-inventory)',
        projects: 'var(--gts-domain-projects)',
        clients: 'var(--gts-domain-clients)',
        vendors: 'var(--gts-domain-vendors)',
        attendance: 'var(--gts-domain-attendance)',
        admin: 'var(--gts-domain-admin)',
      },

      viz: {
        1: 'var(--gts-viz-1)',
        2: 'var(--gts-viz-2)',
        3: 'var(--gts-viz-3)',
        4: 'var(--gts-viz-4)',
        5: 'var(--gts-viz-5)',
        6: 'var(--gts-viz-6)',
        7: 'var(--gts-viz-7)',
        grid: 'var(--gts-viz-grid)',
        axis: 'var(--gts-viz-axis)',
      },
    },

    spacing: {
      0: '0',
      px: '1px',
      1: 'var(--gts-space-1)',
      2: 'var(--gts-space-2)',
      3: 'var(--gts-space-3)',
      4: 'var(--gts-space-4)',
      5: 'var(--gts-space-5)',
      6: 'var(--gts-space-6)',
      8: 'var(--gts-space-8)',
      10: 'var(--gts-space-10)',
      12: 'var(--gts-space-12)',
      16: 'var(--gts-space-16)',
      20: 'var(--gts-space-20)',
      24: 'var(--gts-space-24)',
      32: 'var(--gts-space-32)',
      // Layout frame
      rail: 'var(--gts-rail-expanded)',
      'rail-compact': 'var(--gts-rail-compact)',
      topbar: 'var(--gts-topbar-h)',
      subbar: 'var(--gts-subbar-h)',
      drawer: 'var(--gts-drawer-w)',
      'drawer-wide': 'var(--gts-drawer-w-wide)',
      // Control heights
      'ctl-xs': 'var(--gts-control-xs)',
      'ctl-sm': 'var(--gts-control-sm)',
      'ctl-md': 'var(--gts-control-md)',
      'ctl-lg': 'var(--gts-control-lg)',
      'ctl-xl': 'var(--gts-control-xl)',
      touch: 'var(--gts-touch-min)',
    },

    borderRadius: {
      none: '0',
      xs: 'var(--gts-radius-xs)',
      sm: 'var(--gts-radius-sm)',
      md: 'var(--gts-radius-md)',
      lg: 'var(--gts-radius-lg)',
      xl: 'var(--gts-radius-xl)',
      full: 'var(--gts-radius-full)',
    },

    boxShadow: {
      none: 'none',
      hairline: 'var(--gts-shadow-hairline)',
      raised: 'var(--gts-shadow-raised)',
      overlay: 'var(--gts-shadow-overlay)',
      modal: 'var(--gts-shadow-modal)',
      sheet: 'var(--gts-shadow-sheet)',
      focus: 'var(--gts-shadow-focus)',
    },

    fontSize: {
      '2xs': ['var(--gts-text-2xs)', { lineHeight: '1.3' }],
      xs: ['var(--gts-text-xs)', { lineHeight: 'var(--gts-leading-normal)' }],
      sm: ['var(--gts-text-sm)', { lineHeight: 'var(--gts-leading-table)' }],
      base: ['var(--gts-text-base)', { lineHeight: 'var(--gts-leading-normal)' }],
      md: ['var(--gts-text-md)', { lineHeight: 'var(--gts-leading-normal)' }],
      lg: ['var(--gts-text-lg)', { lineHeight: 'var(--gts-leading-snug)' }],
      xl: ['var(--gts-text-xl)', { lineHeight: 'var(--gts-leading-snug)' }],
      '2xl': ['var(--gts-text-2xl)', { lineHeight: 'var(--gts-leading-tight)', letterSpacing: 'var(--gts-tracking-tight)' }],
      '3xl': ['var(--gts-text-3xl)', { lineHeight: 'var(--gts-leading-tight)', letterSpacing: 'var(--gts-tracking-tight)' }],
      '4xl': ['var(--gts-text-4xl)', { lineHeight: 'var(--gts-leading-tight)', letterSpacing: 'var(--gts-tracking-tighter)' }],
      '5xl': ['var(--gts-text-5xl)', { lineHeight: 'var(--gts-leading-flush)', letterSpacing: 'var(--gts-tracking-tighter)' }],
      '6xl': ['var(--gts-text-6xl)', { lineHeight: 'var(--gts-leading-flush)', letterSpacing: 'var(--gts-tracking-tighter)' }],
    },

    screens: {
      // Matches the six designed widths.
      xs: '390px',
      sm: '430px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
    },

    extend: {
      fontFamily: {
        display: 'var(--gts-font-display)',
        sans: 'var(--gts-font-text)',
        serif: 'var(--gts-font-serif)',
        arabic: 'var(--gts-font-arabic)',
        num: 'var(--gts-font-numeric)',
      },
      letterSpacing: {
        tighter: 'var(--gts-tracking-tighter)',
        tight: 'var(--gts-tracking-tight)',
        snug: 'var(--gts-tracking-snug)',
        normal: 'var(--gts-tracking-normal)',
        wide: 'var(--gts-tracking-wide)',
        caps: 'var(--gts-tracking-caps)',
        'caps-sm': 'var(--gts-tracking-caps-sm)',
      },
      lineHeight: {
        flush: 'var(--gts-leading-flush)',
        tight: 'var(--gts-leading-tight)',
        snug: 'var(--gts-leading-snug)',
        normal: 'var(--gts-leading-normal)',
        relaxed: 'var(--gts-leading-relaxed)',
        table: 'var(--gts-leading-table)',
        'ar-normal': 'var(--gts-leading-ar-normal)',
        'ar-tight': 'var(--gts-leading-ar-tight)',
      },
      maxWidth: {
        content: 'var(--gts-content-max)',
        prose: 'var(--gts-prose-max)',
      },
      zIndex: {
        sticky: '10',
        rail: '20',
        dropdown: '30',
        drawer: '40',
        modal: '50',
        toast: '60',
        tooltip: '70',
      },
      transitionDuration: {
        instant: 'var(--gts-dur-instant)',
        fast: 'var(--gts-dur-fast)',
        base: 'var(--gts-dur-base)',
        slow: 'var(--gts-dur-slow)',
        slower: 'var(--gts-dur-slower)',
      },
      transitionTimingFunction: {
        exit: 'var(--gts-ease-exit)',
        enter: 'var(--gts-ease-enter)',
        move: 'var(--gts-ease-move)',
        snap: 'var(--gts-ease-snap)',
        confirm: 'var(--gts-ease-confirm)',
      },
      animation: {
        'fade-in': 'gts-fade-in var(--gts-dur-base) var(--gts-ease-enter) both',
        rise: 'gts-rise var(--gts-dur-base) var(--gts-ease-enter) both',
        'slide-in': 'gts-slide-in var(--gts-dur-base) var(--gts-ease-enter) both',
        'drawer-in': 'gts-drawer-in var(--gts-dur-slow) var(--gts-ease-snap) both',
        'sheet-in': 'gts-sheet-in var(--gts-dur-slow) var(--gts-ease-snap) both',
        'scale-in': 'gts-scale-in var(--gts-dur-fast) var(--gts-ease-enter) both',
        confirm: 'gts-confirm var(--gts-dur-slower) var(--gts-ease-confirm) both',
        sweep: 'gts-sweep var(--gts-dur-ambient) var(--gts-ease-move) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
