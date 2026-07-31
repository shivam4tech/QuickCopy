export const colors = {
  bg: {
    primary: '#0d1117',
    secondary: '#161b22',
    tertiary: '#21262d',
    hover: '#1c2128',
    active: '#292e36',
  },
  text: {
    primary: '#e6edf3',
    secondary: '#8b949e',
    muted: '#6e7681',
    inverse: '#0d1117',
  },
  border: {
    default: '#30363d',
    muted: '#21262d',
    hover: '#484f58',
    active: '#58a6ff',
  },
  accent: {
    primary: '#58a6ff',
    success: '#3fb950',
    warning: '#d29922',
    error: '#f85149',
    info: '#79c0ff',
  },
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.3)',
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
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 2px 8px rgba(0, 0, 0, 0.3)',
  lg: '0 4px 16px rgba(0, 0, 0, 0.3)',
  xl: '0 8px 32px rgba(0, 0, 0, 0.4)',
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
