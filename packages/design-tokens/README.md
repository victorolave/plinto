# @plinto/design-tokens

The source of truth for Plinto's design tokens: color, typography, spacing,
elevation/motion, and the base reset. Plain CSS custom properties, no build
step — the bundler of whichever app imports this package resolves the files
directly.

Documented in [`docs/design/foundation.md`](../../docs/design/foundation.md).

## Usage

Import the whole set as a barrel:

```css
@import '@plinto/design-tokens';
```

Or a single file, when a consumer only needs part of the set (for example, a
Tailwind `@theme` block that maps its own utilities onto these tokens without
pulling in `base.css`'s reset):

```css
@import '@plinto/design-tokens/colors.css';
@import '@plinto/design-tokens/typography.css';
```

## Consumers

- `apps/web` — the Next.js app; imports the barrel from
  `src/styles/globals.css`.
- `apps/landing` — the marketing site; maps these tokens onto Tailwind's
  `@theme` so both surfaces stay pixel-identical instead of drifting apart.

## Rules

- These files are ported verbatim from the Plinto Design System. Do not
  redefine or approximate a token in a consuming app — add it here if it is
  missing.
- No non-zero `--radius-*` value, ever. The system is square by design.
