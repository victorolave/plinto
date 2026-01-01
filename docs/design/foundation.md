# Foundation

This document defines the **foundation tokens** (typography, colors, and surfaces) for the UI system.

It is aligned with the **`radix-vega`** theme (shadcn), with two intentional overrides:

1. **Base typography:** Montserrat (Google Fonts)
2. **Primary brand color:** `#FD5447`

Everything else should remain consistent with the upstream theme.

---

## 1) Typography

### Base font
- **Family:** Montserrat
- **Source:** Google Fonts
- **Usage:** primary UI font for text, headings, labels, and inputs.

### Recommended implementation (Next.js)

```ts
import { Montserrat } from "next/font/google"

export const fontSans = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})
```

Tailwind config:

```ts
theme: {
  extend: {
    fontFamily: {
      sans: ["var(--font-sans)", "system-ui", "sans-serif"],
    },
  },
}
```

Notes:
- Prefer using the Next.js font `variable` approach so the font is applied via CSS variables (stable, theme-friendly).
- Avoid hardcoding `font-family` directly in components; rely on `font-sans`.

---

## 2) Brand / Primary color

- **HEX:** `#FD5447`
- **OKLCH (approx.):** `oklch(0.676 0.207 28.264)`

Primary usage:
- `primary`: main CTAs and primary actions
- `accent`: visual emphasis when appropriate
- `sidebar-primary`: active navigation / current location

Guidance:
- Use semantic tokens (`primary`, `accent`, etc.) rather than brand hex values in UI code.
- Keep `primary-foreground` readable at AA contrast against `primary`.

---

## 3) Theme CSS tokens (light / dark)

The CSS variables in `globals.css` are the **source of truth** for the theme. They are based on `radix-vega`, with the brand override applied.

```css
/* See the project's globals.css for the full theme token set. */
```

Brand override principle:
- Override the **minimum** required tokens to express the brand (typically `--primary` and any explicitly brand-tied aliases such as `--sidebar-primary`).
- Keep all other tokens identical to `radix-vega` to avoid drift.

---

## 4) Light / dark mode

- Strategy: `.dark` class (shadcn convention).
- Recommended: `next-themes` to manage theme selection (system / light / dark).
- Rule: do not hardcode colors in components; always use semantic tokens.

---

## 5) Conventions

Always use semantic token utilities:
- `bg-background`
- `text-foreground`
- `border-border`
- `bg-primary text-primary-foreground`

Avoid:
- raw color utilities that encode meaning (e.g. `text-red-500` for errors unless mapped through a semantic token)
- inline styles for colors

---

## 6) Checklist

- [ ] Montserrat is loaded and wired via `--font-sans`
- [ ] `primary` matches `#FD5447` in both light and dark modes
- [ ] Components use semantic tokens (no hardcoded colors)

