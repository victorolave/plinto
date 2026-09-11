# Foundation

> **Source of truth:** the token files under
> [`apps/web/src/styles/tokens/`](../../apps/web/src/styles/tokens/)
> (`colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `base.css`),
> imported by [`apps/web/src/styles/globals.css`](../../apps/web/src/styles/globals.css).
> This document describes what is in those files. If the two disagree, the
> files win — update this page to match them, not the other way around.

Plinto's UI system is a Swiss, black/white/red interface with **zero corner
radius everywhere** and no decorative shadows. It is not built on a shadcn
theme, and it does not use Montserrat or `#FD5447` — an earlier version of
this document described a stack that was never shipped. What follows is what
the code actually has.

---

## 1) Typography

### Families

Two families, both self-hosted through `next/font/google` in
[`apps/web/src/app/layout.tsx`](../../apps/web/src/app/layout.tsx), which
exposes them as CSS variables consumed by `typography.css`:

```ts
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
  weight: ['400', '500'],
})
```

Both variables are attached to `<html className>` in the root layout, and
`typography.css` maps them onto the semantic tokens the rest of the system
consumes:

```css
--font-sans: var(--font-archivo), 'Helvetica Neue', Helvetica, Arial, sans-serif;
--font-display: var(--font-sans); /* one voice — display is a size, not a face */
--font-mono: var(--font-dm-mono), 'SFMono-Regular', Menlo, Consolas, monospace;
```

- **Archivo** (400/500/600/700) is the one voice of the interface: display
  type, running heads, and body text alike. A Swiss system does not need a
  second face to make hierarchy — size and tracking do that work.
- **DM Mono** (400/500) sets figures and micro-labels. Tabular monospaced
  digits are what make a column of amounts read as a column, and mono caps
  mark a label as machine-written context rather than prose.
- The token file's own `@import` for these families is deliberately unused —
  the app stays self-hosted and preloaded via `next/font`, with no
  render-blocking request to Google at runtime. A landing page or any other
  consumer outside `apps/web` must self-host the same families (e.g. via
  Fontsource) rather than reintroducing a Google Fonts `@import`.

### Scale

```css
/* interface */
--text-2xs: 12px;
--text-xs: 13px;
--text-sm: 14px;
--text-md: 15px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 22px;
--text-2xl: 28px;
--text-3xl: 36px;

/* display */
--display-sm: 48px;
--display-md: 64px;
--display-lg: 88px;
```

**Nothing in the system renders below 12px, in any context.** `--text-2xs`
is the floor, not a suggestion.

### Weight, leading, tracking, measure

```css
--weight-regular: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;

--leading-flat: 1;
--leading-tight: 1.12;
--leading-snug: 1.3;
--leading-body: 1.55;
--leading-loose: 1.7;

--tracking-display: -0.035em;
--tracking-tight: -0.02em;
--tracking-normal: -0.005em;
--tracking-wide: 0.08em;
--tracking-wider: 0.14em;

--measure: 68ch;
--measure-narrow: 46ch;
```

Hierarchy comes from **size and tracking**, not from swapping faces or
weights: large type is tracked negative until the words lock together; caps
labels are tracked open until they read as a rule of text. Weight moves
between 400 and 700 and never substitutes for scale.

---

## 2) Color

> Black, white, one red. Grey is structure, never decoration. `#E8492C` is a
> SIGNAL — the mark, the active state, the one figure that has to be read. It
> is never a background for pleasure. Red as TEXT only ever appears at
> red-700 (6.4:1); the brand red itself carries INK text, never white.

### Palette

```css
--white: #ffffff;
--black: #000000;

--neutral-0: #ffffff;
--neutral-50: #f7f7f7;
--neutral-100: #f0f0f0;
--neutral-200: #e2e2e2;
--neutral-300: #c9c9c9;
--neutral-400: #9b9b9b;
--neutral-500: #6e6e6e;
--neutral-600: #4a4a4a;
--neutral-700: #2e2e2e;
--neutral-800: #1a1a1a;
--neutral-900: #0a0a0a;

--red-50: #fdece9;
--red-100: #fad6cf;
--red-200: #f5b3a6;
--red-300: #f0907c;
--red-400: #ec6c53;
--red-500: #e8492c; /* brand */
--red-600: #cc3a20;
--red-700: #a32c17;
--red-800: #7a2010;

--green-500: #0e8a55;
--green-600: #0a6b42;
--amber-500: #b45309;
```

The brand red is `#E8492C` (`--red-500`) — not `#FD5447`, which never existed
in the shipped system.

### Surfaces

```css
--surface-page: var(--neutral-50);   /* the canvas: light grey */
--surface-card: var(--neutral-0);    /* blocks sit white ON the canvas */
--surface-inset: var(--neutral-100);
--surface-sunken: var(--neutral-100);
--surface-raised: var(--neutral-0);
--surface-hover: var(--neutral-50);
--surface-active: var(--neutral-100);
--surface-ink: var(--neutral-900);
--surface-accent: var(--red-500);
```

### Text

```css
--text-strong: var(--neutral-900);
--text-body: var(--neutral-800);
--text-muted: var(--neutral-500);
--text-subtle: var(--neutral-500);
--text-disabled: var(--neutral-400);
--text-on-ink: var(--neutral-0);
--text-on-accent: var(--neutral-900);
--text-accent: var(--red-700);
```

### Borders, rules, grid

```css
--border-hair: var(--neutral-200);
--border-default: var(--neutral-300);
--border-strong: var(--neutral-900);
--rule-hair: var(--neutral-200);
--rule-strong: var(--neutral-900);
--grid-line: rgba(10, 10, 10, 0.09);
```

### Actions

```css
--action-primary: var(--neutral-900);
--action-primary-hover: var(--neutral-700);
--action-primary-active: var(--neutral-600);
--action-primary-text: var(--neutral-0);
--action-accent: var(--red-500);
--action-accent-hover: var(--red-400);
--action-accent-active: var(--red-600);
--action-accent-text: var(--neutral-900);
```

`--action-accent-text` is `var(--neutral-900)`, **not white** — the brand red
always carries ink text, in either theme. This is deliberate and must not be
"fixed" to white for contrast; red-500 against white text fails the system's
own reading, which is why red as text is only ever used at red-700.

### Status

```css
--status-positive: var(--green-600);
--status-negative: var(--neutral-900);
--status-danger: var(--red-700);
--status-warning: var(--amber-500);
--status-info: var(--neutral-900);
--status-positive-on-ink: #3ecf8e;
```

Income figures read on an inverse block, so the green that clears AA against
`--surface-ink` has to flip the opposite way of the rest of the palette: a
light green (`--status-positive-on-ink`) on the black block, the darker one
on the white block.

### Focus

```css
--focus-inner: var(--surface-page);
--focus-outer: var(--neutral-900);
```

### App chrome — the permanent black block

```css
--surface-chrome: var(--neutral-900);
--surface-chrome-raised: #141414;
--chrome-text-strong: var(--neutral-0);
--chrome-text-muted: rgba(255, 255, 255, 0.66);
--chrome-text-subtle: rgba(255, 255, 255, 0.44);
--chrome-border: rgba(255, 255, 255, 0.14);
--chrome-hover: rgba(255, 255, 255, 0.09);
```

Deliberately **not** `--surface-ink`: an inverse block flips with the theme,
but the chrome (sidebar, bottom nav) is black in daylight and black at night.
Its foreground is stated as white alphas so it stays legible on the block
regardless of which theme is painting around it.

### Dark theme

`[data-theme='dark']` redefines the surface, text, border, action, status,
and focus tokens above — same red, true black instead of `--neutral-50`, true
white instead of `--neutral-900`. The chrome only drops one step further
(`--surface-chrome: #050505`) so the page beside it still reads as the
lighter surface. See `colors.css` for the full dark block; it is not repeated
here to avoid a second copy drifting from the source.

---

## 3) Space & geometry

> 4px grid. Every corner is square: the system draws with lines, and a
> radius would soften the only structure there is. Density is medium — a
> 40px control, a 14px row, a 40px page margin — dense enough for a ledger,
> open enough to read at a glance.

### Spacing scale (4px grid)

```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 32px;
--space-8: 40px;
--space-9: 48px;
--space-10: 64px;
--space-11: 80px;
--space-12: 120px;
```

### Radius — square, all of it

```css
--radius-none: 0;
--radius-control: 0;
--radius-chip: 0;
--radius-card: 0;
--radius-pill: 0;
--radius-avatar: 0;
```

**Every `--radius-*` token is `0`.** This is not a placeholder waiting for a
future value — it is the system. Nothing in Plinto's UI has a rounded
corner, including pills, chips, and avatars.

### Controls and layout

```css
--control-sm: 32px;
--control-md: 40px;
--control-lg: 48px;
--target-min-aa: 44px;

--border-width: 1px;
--border-width-strong: 2px;

--page-margin: 40px;
--gutter: 32px;
--sidebar-w: 240px;
--topbar-h: 60px;
--pad-row: 14px;
--pad-block: 24px;
--grid-columns: 12;
```

---

## 4) Rules, elevation, motion

> Structure is drawn with rules: 2px opens a section, 1px separates entries,
> nothing else divides anything. `--shadow-xs` and `--shadow-sm` resolve to
> `none` on purpose, so reaching for one on a panel quietly does nothing. The
> remaining steps are for layers that genuinely leave the page — menu,
> dialog, toast.

### Rules and shadows

```css
--rule-width-hair: 1px;
--rule-width-strong: 2px;

--shadow-xs: none;
--shadow-sm: none;
--shadow-md: 0 8px 24px rgba(10, 10, 10, 0.12);
--shadow-lg: 0 16px 48px rgba(10, 10, 10, 0.16);
--shadow-overlay: 0 24px 64px rgba(10, 10, 10, 0.22);

--scrim: rgba(10, 10, 10, 0.55);
```

`--shadow-xs` and `--shadow-sm` are `none` deliberately. Do not fill them in
"to add a bit of depth" — a panel or card is flat by design, and only
elements that leave the page's own plane (menus, dialogs, toasts) get a
shadow.

### Motion

> Precise and quick. No spring, no bounce, no loop.

```css
--duration-fast: 120ms;
--duration-base: 180ms;
--duration-slow: 280ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);
```

`base.css` also respects `prefers-reduced-motion: reduce` globally, collapsing
every animation and transition to effectively `0.01ms`.

### Z-index

```css
--z-base: 0;
--z-sticky: 100;
--z-dropdown: 300;
--z-overlay: 500;
--z-modal: 600;
--z-toast: 800;
```

---

## 5) Base layer

`base.css` is a light reset plus the handful of helpers the whole system
leans on:

- A single focus treatment for the whole app: a 2px ink ring
  (`--focus-outer`), offset so it never sits on the control's own border.
- `.plinto-eyebrow` — the only all-caps in the system, set in `--font-mono`
  at `--text-2xs` with `--tracking-wider`.
- `.plinto-money` — tabular figures (`font-variant-numeric: tabular-nums`),
  because a column of amounts must align.
- `.plinto-grid` — the visible column grid, driven by `--grid-line` and
  `--grid-columns`, for exposing the Swiss structure a layout is built on.
- `.plinto-rule` / `.plinto-rule--strong` — the 1px and 2px dividers that
  replace borders as the system's way of separating content.
- `::selection` uses `--surface-accent` / `--text-on-accent` — the one place
  outside a signal state where the brand red is allowed to be a background,
  because text selection is inherently transient and user-triggered, not
  decorative.

---

## 6) Conventions

- Always consume the **semantic** tokens (`--surface-*`, `--text-*`,
  `--action-*`, `--status-*`), never the raw palette (`--red-500`,
  `--neutral-900`) directly in component code. The palette exists so the
  semantic layer has something to point at, not for direct use.
- Never introduce a non-zero `--radius-*` value. If a component looks like it
  needs a rounded corner, that is a signal the component does not fit this
  system yet — not a reason to add roundness.
- Never fill in `--shadow-xs` or `--shadow-sm`. If something needs to lift
  off the page, reach for `--shadow-md` and up, or reconsider whether it
  should leave the page's plane at all.
- Do not hardcode `#E8492C`, hex greys, or pixel values for spacing/type in
  component code — every one of them has a token.
- Any consumer outside `apps/web` (for example a landing page) must import
  the same token files rather than redefining or approximating these values,
  so the two surfaces cannot drift apart.

## 7) Checklist

- [ ] Archivo and DM Mono are loaded via `next/font` and wired through
      `--font-archivo` / `--font-dm-mono`, never a Google Fonts `@import`
- [ ] The brand red matches `#E8492C` (`--red-500`) in both light and dark
      modes
- [ ] Every corner in the UI has zero radius
- [ ] `--shadow-xs` / `--shadow-sm` remain `none`
- [ ] Components use semantic tokens, never raw palette values or hardcoded
      hex/pixel values
