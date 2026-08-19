/**
 * Single source of truth for the sidebar's shadow-DOM theme tokens.
 * Must stay in sync with `src/styles/global.css` — the sidebar cannot
 * import CSS directly, so these strings are inlined into its shadow
 * stylesheet by `src/content/sidebar/index.ts`.
 */
export const SIDEBAR_THEME_TOKENS = `
  --color-bg-primary: #0a0a0c;
  --color-bg-secondary: #101012;
  --color-bg-tertiary: #151518;
  --color-bg-hover: #18181c;
  --color-bg-active: #1e1e23;
  --color-text-primary: #f2f2f3;
  --color-text-secondary: #a9a9b4;
  --color-text-muted: #7e7e88;
  --color-text-inverse: #0a0a0c;
  --color-on-accent: #0a0a0c;
  --color-border-default: rgba(255, 255, 255, 0.1);
  --color-border-muted: rgba(255, 255, 255, 0.06);
  --color-border-hover: rgba(255, 255, 255, 0.16);
  --color-border-active: #f4c84e;
  --color-accent-primary: #f4c84e;
  --color-accent-success: #3ecf7a;
  --color-accent-warning: #e5b93d;
  --color-accent-error: #f2554d;
  --color-accent-info: #8fa3d1;
  --color-accent-success-soft: rgba(62, 207, 122, 0.12);
  --color-accent-warning-soft: rgba(229, 185, 61, 0.12);
  --color-accent-error-soft: rgba(242, 85, 77, 0.12);
  --color-accent-info-soft: rgba(143, 163, 209, 0.12);
  --color-overlay: rgba(0, 0, 0, 0.6);
  --color-shadow: rgba(0, 0, 0, 0.5);
  --gradient-primary: #ffffff;
  --gradient-primary-hover: #f4f4f5;
  --gradient-primary-active: #e4e4e7;
  --gradient-secondary: rgba(255, 255, 255, 0.05);
  --gradient-secondary-hover: rgba(255, 255, 255, 0.09);
  --gradient-secondary-active: rgba(255, 255, 255, 0.12);
  --gradient-danger: #f2554d;
  --btn-primary-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  --btn-primary-shadow-hover: 0 1px 4px rgba(0, 0, 0, 0.3);
  --focus-ring: rgba(244, 200, 78, 0.4);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.35);
  --shadow-xl: 0 24px 64px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.45);
`;

export const SIDEBAR_THEME_TOKENS_LIGHT = `
  --color-bg-primary: #f7f7f5;
  --color-bg-secondary: #ffffff;
  --color-bg-tertiary: #ececea;
  --color-bg-hover: #efefec;
  --color-bg-active: #e5e5e1;
  --color-text-primary: #141417;
  --color-text-secondary: #3f3f46;
  --color-text-muted: #58585f;
  --color-text-inverse: #ffffff;
  --color-on-accent: #ffffff;
  --color-border-default: rgba(23, 23, 26, 0.15);
  --color-border-muted: rgba(23, 23, 26, 0.09);
  --color-border-hover: rgba(23, 23, 26, 0.25);
  --color-border-active: #7a5707;
  --color-accent-primary: #7a5707;
  --color-accent-success: #147a41;
  --color-accent-warning: #825a08;
  --color-accent-error: #cf222e;
  --color-accent-info: #4d6190;
  --color-accent-success-soft: rgba(20, 122, 65, 0.09);
  --color-accent-warning-soft: rgba(130, 90, 8, 0.12);
  --color-accent-error-soft: rgba(207, 34, 46, 0.08);
  --color-accent-info-soft: rgba(77, 97, 144, 0.09);
  --color-overlay: rgba(23, 23, 26, 0.35);
  --color-shadow: rgba(23, 23, 26, 0.16);
  --gradient-primary: #17171a;
  --gradient-primary-hover: #2b2b31;
  --gradient-primary-active: #000000;
  --gradient-secondary: #ffffff;
  --gradient-secondary-hover: #f4f4f2;
  --gradient-secondary-active: #ececea;
  --gradient-danger: #cf222e;
  --btn-primary-shadow: 0 1px 3px rgba(23, 23, 26, 0.16);
  --btn-primary-shadow-hover: 0 1px 4px rgba(23, 23, 26, 0.18);
  --focus-ring: rgba(122, 87, 7, 0.32);
  --shadow-sm: 0 1px 2px rgba(23, 23, 26, 0.08);
  --shadow-md: 0 2px 8px rgba(23, 23, 26, 0.1);
  --shadow-lg: 0 8px 24px rgba(23, 23, 26, 0.1), 0 2px 6px rgba(23, 23, 26, 0.06);
  --shadow-xl: 0 24px 64px rgba(23, 23, 26, 0.14), 0 8px 16px rgba(23, 23, 26, 0.08);
`;
