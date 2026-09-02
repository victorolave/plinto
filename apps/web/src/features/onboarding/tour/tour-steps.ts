import type { DriveStep } from 'driver.js'

export type TourStepId =
  | 'welcome'
  | 'household'
  | 'accounts'
  | 'transactions'
  | 'obligations'
  | 'debts'
  | 'credit'
  | 'categories'
  | 'firstSteps'
  | 'help'

export interface BuildTourStepsOptions {
  isMobile: boolean
}

/** Minimal shape of `useTranslations('tour')` this module actually calls. */
type Translate = (key: string) => string

interface StepAnchor {
  id: TourStepId
  /** CSS selector to highlight. Undefined = a centered popover with no target. */
  selector?: string
  /**
   * Overrides `selector` when `isMobile` is true. Only set on steps whose
   * anchor differs (or disappears) on small screens — `null` means centered
   * on mobile, a string points at a mobile-only element instead.
   */
  mobileSelector?: string | null
}

/**
 * Order and anchors for every tour step. `data-tour` values here must match
 * the attributes rendered on the sidebar, bottom nav, tenant switcher, help
 * button, and first-steps card — see dashboard-shell.tsx / sidebar.tsx /
 * bottom-nav.tsx / first-steps-card.tsx.
 *
 * `accounts` and `transactions` share their selector with both the sidebar
 * link AND the bottom-nav bar link — the sidebar collapses under 900px
 * (globals.css) but both elements exist in the DOM at all times, so
 * `findVisibleElement` below (not a plain `document.querySelector`) is what
 * actually picks the one currently rendered. `obligations`/`debts`/`credit`/
 * `categories` only live inside the bottom nav's collapsible "more" sheet,
 * which the tour cannot force open, so those are centered on mobile instead
 * of pointing at a hidden target.
 */
const STEP_ANCHORS: StepAnchor[] = [
  { id: 'welcome' },
  { id: 'household', selector: '[data-tour="tenant-switcher"]', mobileSelector: null },
  { id: 'accounts', selector: '[data-tour="nav-accounts"]' },
  { id: 'transactions', selector: '[data-tour="nav-transactions"]' },
  { id: 'obligations', selector: '[data-tour="nav-obligations"]', mobileSelector: null },
  { id: 'debts', selector: '[data-tour="nav-debts"]', mobileSelector: null },
  { id: 'credit', selector: '[data-tour="nav-credit"]', mobileSelector: null },
  { id: 'categories', selector: '[data-tour="nav-categories"]', mobileSelector: null },
  { id: 'firstSteps', selector: '[data-tour="first-steps"]' },
  {
    id: 'help',
    selector: '[data-tour="help-button"]',
    mobileSelector: '[data-tour="help-more-item"]',
  },
]

/**
 * Whether `el` is actually rendered, not merely present in the DOM.
 *
 * `offsetParent` is null both for an element inside a `display:none`
 * ancestor AND for a `position: fixed` element (which has no offset
 * parent even though it's visible) — `getClientRects()` is the fallback
 * that still reports a rect for the fixed case, per MDN's own recipe for
 * this check.
 */
function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true
  return el.offsetParent !== null || el.getClientRects().length > 0
}

/**
 * Finds the first VISIBLE element matching `selector`. Some anchors
 * (accounts/transactions) exist twice in the DOM at once — once in the
 * sidebar, once in the bottom nav — with only one ever actually rendered at
 * a given viewport (the other sits behind `display:none`). A plain
 * `document.querySelector` always returns the first match in document
 * order regardless of which one is shown, and driver.js 1.8 happily
 * highlights a 0×0 hidden element (it only checks that the selector
 * resolved to *something*) — so this scans every match instead of taking
 * the first.
 */
function findVisibleElement(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') return null

  const candidates = Array.from(document.querySelectorAll(selector))
  for (const candidate of candidates) {
    if (isVisible(candidate)) return candidate as HTMLElement
  }

  return null
}

/**
 * Builds the driver.js steps for the guided tour from i18n.
 *
 * Anchored steps whose element is not currently visible in the DOM are
 * dropped entirely — a household with no first-steps card left (everything
 * is already done) simply never sees that step, rather than the tour
 * pointing at nothing (or, on mobile, at a sidebar link hidden behind
 * `display:none`). Deliberately centered steps (no selector at all — the
 * opening step, or "household"/the four bottom-sheet-only sections on
 * mobile) are never filtered — they have no element to be missing.
 */
export function buildTourSteps(t: Translate, { isMobile }: BuildTourStepsOptions): DriveStep[] {
  const steps: DriveStep[] = []

  for (const anchor of STEP_ANCHORS) {
    const selector =
      isMobile && 'mobileSelector' in anchor ? anchor.mobileSelector : anchor.selector

    let element: DriveStep['element']

    if (selector) {
      const target = findVisibleElement(selector)
      if (!target) continue
      // A resolver function, not the raw selector string: driver.js resolves
      // a string target with its own plain `document.querySelector`, which
      // would undo the visible-element pick above by re-selecting the first
      // (possibly hidden) DOM match. Handing it the exact node found here
      // keeps the two in sync.
      element = () => target
    }

    steps.push({
      element,
      popover: {
        title: t(`steps.${anchor.id}.title`),
        description: t(`steps.${anchor.id}.description`),
      },
    })
  }

  return steps
}
