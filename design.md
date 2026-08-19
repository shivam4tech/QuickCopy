# Design System

> Liquid-glass UI, theme-driven tokens, and motion guidelines for Ekadanta.

Ekadanta uses an Apple-inspired **liquid glass** aesthetic (with Raycast-style
dark surfaces) across the options page, popup, and the in-page capture panel.
Everything visual comes from theme tokens — there are no hardcoded colors
in components.

## Theme modes

Three modes, controlled by the `theme` setting:

| Mode | Behavior |
|---|---|
| `dark` | Default. Charcoal surfaces, white-alpha borders, accent `#63b0ff`. |
| `light` | Paper-white surfaces, slate borders, accent `#0969da`. |
| `system` | Follows the OS `prefers-color-scheme` live (via `matchMedia` listener). |

The resolved theme is applied as `data-theme="dark" | "light"` on the document
root (extension pages) or on the shadow host (sidebar). `color-scheme` follows
the theme on `:root`, which keeps native widgets (scrollbars, form controls)
consistent.

## Theme architecture

| Piece | Location | Purpose |
|---|---|---|
| Token definitions (CSS) | `src/styles/global.css` | Two token blocks: `:root` (dark, default) and `:root[data-theme='light']`. Every variable exists in both. |
| Token aliases (TS) | `src/styles/designSystem.ts` | Typed `colors`, `spacing`, `radius`, `fonts`, `fontSizes`, `fontWeights`, `shadows`, `gradients`, `buttonShadows`, `animation`, `zIndex` — all map to `var(--…)` so components never hardcode values. |
| Theme engine | `src/utils/theme.ts` | `resolveThemeMode()`, `createThemeApplier()` (keeps `system` in sync with the OS), `themeController.setTheme(mode)` bound to `document.documentElement`. |
| Sidebar tokens (duplicated) | `src/content/sidebar/index.ts` | The sidebar lives in a **closed shadow root**, so it cannot read page CSS. `SIDEBAR_THEME_TOKENS` (dark) and `SIDEBAR_THEME_TOKENS_LIGHT` re-declare the same tokens on `:host`. **Must stay in sync with `global.css`.** |
| Application | `src/options/main.tsx`, `src/popup/main.tsx` | Apply theme after settings load and on every `settings:changed` event (guarded `partial.theme !== undefined`). |

> **Rule:** if you change a token in `global.css`, mirror it in both sidebar
> host blocks in `src/content/sidebar/index.ts`, or the sidebar will drift
> from the rest of the extension.

## Palette

Dark (default):

| Token | Value | Use |
|---|---|---|
| `--color-bg-primary` | `#0d0f14` | Page background |
| `--color-bg-secondary` | `#151922` | Raised surfaces (cards, dropdown list) |
| `--color-bg-tertiary` | `#1d222c` | Track / inset surfaces (segmented control) |
| `--color-bg-hover` / `--color-bg-active` | `#1a1f29` / `#262c38` | Hover / pressed states |
| `--color-text-primary` | `#f0f3f8` | Primary text |
| `--color-text-secondary` | `#a3adbb` | Secondary text |
| `--color-text-muted` | `#7b8594` | Muted / helper text |
| `--color-accent-primary` | `#63b0ff` | Accent |
| `--color-border-default` | `rgba(255,255,255,0.14)` | Hairline borders (white-alpha, not hard gray) |

Light overrides: `bg-primary #f5f7fa`, `bg-secondary #ffffff`,
`bg-tertiary #e9edf2`, `text-primary #1c2126`, `accent-primary #0969da`,
`border-default #cfd7e0`. Success / warning / error accents exist in both
themes (`#4ac26b/#e3b341/#ff6b66` dark; `#1a7f37/#9a6700/#cf222e` light), each
with a matching `-soft` translucent variant.

## Liquid glass recipe

Floating surfaces (sidebar panel, collapse pill, popup cards):

```css
background: var(--glass-bg);              /* dark: rgba(24,28,36,0.62)  light: rgba(255,255,255,0.7) */
background-image: var(--glass-sheen);     /* top-to-bottom glow (Liquid Glass 2.0) */
backdrop-filter: blur(24px) saturate(180%);
border: 1px solid var(--glass-border);    /* dark: rgba(255,255,255,0.16)  light: rgba(15,23,42,0.1) */
border-radius: 20px;                       /* panel; 18px for controls, 999px for pills */
box-shadow:
  0 0 0 1px var(--glass-rim),             /* soft outer rim for edge separation on dark pages */
  inset 0 1px 0 var(--glass-highlight),   /* machined top edge */
  var(--shadow-xl);                        /* heavy layered drop shadow */
```

Notes:

- `Card.tsx` intentionally uses **no `backdrop-filter`** — the settings page
  is static, so blur adds nothing visually while consuming GPU memory.
- `--glass-bg-strong` (`rgba(32,37,46,0.82)` dark / `rgba(255,255,255,0.85)`
  light) is used for text/textarea wells inside glass panels.
- Shadows escalate by elevation: `--shadow-md` (pill), `--shadow-lg`
  (dropdown), `--shadow-xl` (floating panel). Dark shadows are intentionally
  heavy; light shadows stay soft.
- Page ambience: three fixed radial glows (`--page-glow-a/b/c`) tint the
  options page background per theme.

## Components

All components live in `src/components/ui/` and are typed against
`designSystem.ts`.

| Component | Design |
|---|---|
| `Button` | `primary`: `--gradient-primary` + accent glow shadow (`--btn-primary-shadow`), hover brightens, press translates 1px with inset shadow. `secondary`: glass gradient surface. `danger` variant uses `--gradient-danger`. Sizes `sm / md / lg`. |
| `Select` | **Fully custom dropdown** (no native `<select>`). Native popups are OS-rendered — Chrome ignored the page's `color-scheme` and rendered a white popup with unreadable text, so the list is now in-page DOM: `role="combobox"/"listbox"`, arrow/enter/escape navigation, checkmark on the selected item, list auto-widens (`min-width: max-content`) to fit the longest label, capped to the viewport. Trigger is `--gradient-secondary`, 8px radius, 3px focus ring. |
| `Switch` | 32×18 track, 12px knob. On: `--gradient-primary` with a faint 8px glow. Knob slides with an Apple-style **squish** (Web Animations API: `translateX` + `scaleX(1.34)` mid-keyframe, 340ms spring). Honors `prefers-reduced-motion`. |
| Segmented control | Popup **On/Off** control: `bg-tertiary` track with an absolutely-positioned `bg-secondary` thumb that slides between segments (`transform` transition, 300ms spring `cubic-bezier(0.34,1.56,0.64,1)`). Label/dot colors crossfade. |
| `Card` | Static glass card: `bg-secondary`, hairline border, 18px radius, no backdrop blur (see above). |
| `Badge` | Pill with inset top highlight. |
| `Tooltip` | Small floating label, appears on hover/focus. |

## Sidebar panel (in-page capture panel)

- Compact: **280px wide**, `max-height: min(36vh, 294px)`, 18px radius,
  pinned top-right (`top/right: 10px`).
- Header: logo + status dot/label + minimize/close icon buttons.
- Body: confidence line, result well (`bg-strong`, `max-height: 18vh`), or a
  loading spinner; edit mode uses a 100px+ textarea.
- Footer: `sm` Copy (primary) + Close (secondary) buttons.
- Collapse pill: horizontal capsule matching the On/Off control language —
  `bg-tertiary` track, `bg-secondary` thumb circle containing the logo,
  status dot, "Open" label. Fully rounded, `blur(16px) saturate(140%)`.
- Motion: panel enters with `qc-pop` (spring, scale 0.92 + slide 22px),
  exits with `qc-pop-out` (300ms ease-in, forwards; unmounts on
  `animationend`), pill fades/scales in (`qc-fade-in` 280ms).

## Motion guidelines

Tokenized in `designSystem.ts` (`animation.duration`, `animation.easing`):

- Durations: `fast 100ms`, `normal 200ms`, `slow 300ms`, `slower 400ms`.
- Easings: `spring cubic-bezier(0.34,1.56,0.64,1)` (entrances, toggles),
  `ease`, `easeOut`, `easeIn` (exits).
- **Animate only `transform` and `opacity`** — anything else causes layout
  thrash.
- Keep it light: no looping, no keyframe-heavy effects, no animation
  libraries. WAAPI is used only where CSS transitions can't express the
  motion (switch squish).
- Respect `prefers-reduced-motion` (switch squish and dropdown pop-in are
  gated on it; CSS animations are kept tiny and non-essential).

## Changing the design

1. Edit tokens in `src/styles/global.css` (dark block, light block).
2. Mirror the changes in `src/content/sidebar/index.ts`
   (`SIDEBAR_THEME_TOKENS` and `SIDEBAR_THEME_TOKENS_LIGHT`).
3. Use token aliases from `designSystem.ts` in any new component — never
   hardcode hex values.
4. Verify: `npm run typecheck`, `npm test`, `npm run build`,
   `npm run build:firefox`.

## Icons

The extension icon is generated from `scripts/generate-icons.ts`
(`npm run generate-icons`) into `public/icons/icon{16,48,128}.png`,
referenced by `src/manifest.json`. To replace the icon, either edit the
drawing code in that script and re-run it, or drop your own PNGs over the
three files in `public/icons/` and rebuild.
