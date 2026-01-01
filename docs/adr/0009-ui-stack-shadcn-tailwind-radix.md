# ADR 0009: Web UI Stack with shadcn/ui, Tailwind CSS, and Radix UI

- **Status**: Accepted
- **Date**: 2026-01-01
- **Deciders**: Plinto Maintainer(s)
- **Context**: UI component strategy for `apps/web`

## Context

Plinto's Web application (`apps/web`) needs a UI foundation that:

- is fast to build with for an MVP, without locking us into a heavy framework
- supports a consistent design language and reusable components
- prioritizes accessibility (keyboard navigation, focus management, ARIA patterns)
- fits naturally with Next.js and a TypeScript codebase
- is easy to customize for product branding (themes, spacing, typography)
- can evolve into an internal design system over time

We want to avoid:

- a large, opinionated component library that is hard to customize
- a UI stack that produces inaccessible components by default
- a pure “copy-paste UI” approach without primitives/patterns to standardize behavior

## Decision

For `apps/web`, Plinto will use:

1. **Tailwind CSS** for styling (utility-first, theme tokens, and predictable composition).
2. **shadcn/ui** as the component baseline (components live in our repo and are owned/customized by us).
3. **Radix UI** primitives for accessible behaviors and patterns (dialogs, menus, popovers, selects, etc.).

shadcn/ui components will be treated as **source code** in the repository (not as an external “UI framework”), and can be modified as needed to match Plinto's product requirements.

## Justification

### Why Tailwind CSS
- Enables rapid iteration and consistent styling without bespoke CSS sprawl.
- Works well with design tokens (CSS variables) for theming (light/dark, brand colors).
- Encourages composition of small UI pieces with minimal runtime overhead.

### Why shadcn/ui
- Provides a practical starting set of well-designed components for product UIs.
- Components are copied into the codebase, making them easy to tailor and audit.
- Pairs naturally with Tailwind and Radix UI patterns.

### Why Radix UI
- Provides accessible, battle-tested primitives (focus management, keyboard interactions).
- Reduces the risk of subtle accessibility regressions in interactive components.
- Keeps behavior concerns separated from styling concerns (Tailwind).

## Consequences

### Positive
- Faster delivery of a cohesive UI in early versions of the product.
- Accessible defaults for common interactive components.
- Full ownership of component code, enabling product-specific tweaks.

### Negative / Trade-offs
- Upgrading shadcn/ui patterns is not a single “library upgrade”; we will periodically reconcile changes manually.
- Tailwind-heavy code can become verbose; we must keep utility usage disciplined and componentized.
- Some advanced components may still require additional work to match desired UX (e.g., complex data tables).

### Mitigations
- Centralize primitives in a standard location (e.g., `apps/web/components/ui`) and reuse them consistently.
- Establish conventions for theming tokens and component variants to avoid style drift.
- Prefer Radix primitives for interactive behaviors; avoid building custom equivalents unless necessary.

## Alternatives Considered

1. **Material UI / Chakra / Mantine**
   - Pros: comprehensive component sets, quick initial delivery.
   - Cons: heavier opinionation and styling constraints; harder to deeply customize and “own” the system.

2. **Headless UI without shadcn/ui**
   - Pros: fully headless and flexible.
   - Cons: more work to establish a cohesive baseline of styled components for an MVP.

3. **Custom design system from scratch**
   - Pros: maximum control.
   - Cons: too costly upfront; risks slowing product delivery.

## Implementation Notes

- Tailwind CSS will be the default styling approach for `apps/web`.
- shadcn/ui components will be vendored into the repo and treated as first-class source.
- Radix UI packages will be used where interactive primitives are needed to ensure accessibility and consistency.

