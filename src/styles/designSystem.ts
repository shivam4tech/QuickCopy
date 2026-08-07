/**
 * Theme-driven design tokens. Values are CSS custom properties so a `data-theme`
 * flip on the document (or the sidebar's shadow host) restyles every consumer
 * without re-rendering. Declared in `styles/global.css` for extension pages and
 * in the sidebar's shadow stylesheet for the in-page panel.
 */
export const colors = {
  bg: {
    primary: 'var(--color-bg-primary)',
    secondary: 'var(--color-bg-secondary)',
    tertiary: 'var(--color-bg-tertiary)',
    hover: 'var(--color-bg-hover)',
    active: 'var(--color-bg-active)',
  },
  text: {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted: 'var(--color-text-muted)',
    inverse: 'var(--color-text-inverse)',
    onAccent: 'var(--color-on-accent)',
  },
  border: {
    default: 'var(--color-border-default)',
    muted: 'var(--color-border-muted)',
    hover: 'var(--color-border-hover)',
    active: 'var(--color-border-active)',
  },
  accent: {
    primary: 'var(--color-accent-primary)',
    success: 'var(--color-accent-success)',
    warning: 'var(--color-accent-warning)',
    error: 'var(--color-accent-error)',
    info: 'var(--color-accent-info)',
  },
  accentSoft: {
    success: 'var(--color-accent-success-soft)',
    warning: 'var(--color-accent-warning-soft)',
    error: 'var(--color-accent-error-soft)',
    info: 'var(--color-accent-info-soft)',
  },
  glass: {
    bg: 'var(--glass-bg)',
    bgStrong: 'var(--glass-bg-strong)',
    border: 'var(--glass-border)',
    highlight: 'var(--glass-highlight)',
    rim: 'var(--glass-rim)',
    shadow: 'var(--glass-shadow)',
    hover: 'var(--hover-overlay)',
    sheen: 'var(--glass-sheen)',
  },
  overlay: 'var(--color-overlay)',
  shadow: 'var(--color-shadow)',
  focusRing: 'var(--focus-ring)',
} as const;

export const gradients = {
  primary: 'var(--gradient-primary)',
  primaryHover: 'var(--gradient-primary-hover)',
  primaryActive: 'var(--gradient-primary-active)',
  secondary: 'var(--gradient-secondary)',
  secondaryHover: 'var(--gradient-secondary-hover)',
  secondaryActive: 'var(--gradient-secondary-active)',
  danger: 'var(--gradient-danger)',
} as const;

export const buttonShadows = {
  primary: 'var(--btn-primary-shadow)',
  primaryHover: 'var(--btn-primary-shadow-hover)',
} as const;

export const spacing = {
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  12: '48px',
  14: '56px',
  16: '64px',
} as const;

export const radius = {
  none: '0',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
} as const;

export const fonts = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
} as const;

export const fontSizes = {
  xs: '11px',
  sm: '12px',
  base: '14px',
  lg: '16px',
  xl: '18px',
  '2xl': '20px',
  '3xl': '24px',
} as const;

export const fontWeights = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeights = {
  none: 1,
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const animation = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    slowest: '500ms',
  },
  easing: {
    linear: 'linear',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export const shadows = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  popover: 1100,
  tooltip: 1200,
  modal: 1300,
  notification: 1400,
  overlay: 2147483646,
  sidebar: 2147483647,
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

export type DesignSystemColors = typeof colors;
export type DesignSystemSpacing = typeof spacing;
export type DesignSystemRadius = typeof radius;
export type DesignSystemFonts = typeof fonts;
export type DesignSystemFontSizes = typeof fontSizes;
export type DesignSystemAnimation = typeof animation;
export type DesignSystemShadows = typeof shadows;
export type DesignSystemZIndex = typeof zIndex;
