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
   * on mobile, a string points at the mobile-only element instead.
   */
  mobileSelector?: string | null
}

/**
 * Order and anchors for every tour step. `data-tour` values here must match
 * the attributes rendered on the sidebar, tenant switcher, help button, and
 * first-steps card — see dashboard-shell.tsx / sidebar.tsx / bottom-nav.tsx /
 * first-steps-card.tsx.
 */
const STEP_ANCHORS: StepAnchor[] = [
  { id: 'welcome' },
  { id: 'household', selector: '[data-tour="tenant-switcher"]', mobileSelector: null },
  { id: 'accounts', selector: '[data-tour="nav-accounts"]' },
  { id: 'transactions', selector: '[data-tour="nav-transactions"]' },
  { id: 'obligations', selector: '[data-tour="nav-obligations"]' },
  { id: 'debts', selector: '[data-tour="nav-debts"]' },
  { id: 'credit', selector: '[data-tour="nav-credit"]' },
  { id: 'categories', selector: '[data-tour="nav-categories"]' },
  { id: 'firstSteps', selector: '[data-tour="first-steps"]' },
  {
    id: 'help',
    selector: '[data-tour="help-button"]',
    mobileSelector: '[data-tour="help-more-item"]',
  },
]

/** Whether `selector` currently resolves to an element in the DOM. */
function existsInDom(selector: string): boolean {
  if (typeof document === 'undefined') return false
  return document.querySelector(selector) !== null
}

/**
 * Builds the driver.js steps for the guided tour from i18n.
 *
 * Anchored steps whose element is not currently in the DOM are dropped
 * entirely — a household with no first-steps card left (everything is
 * already done) simply never sees that step, rather than the tour pointing
 * at nothing. Deliberately centered steps (no selector at all, e.g. the
 * opening step, or "household" on mobile) are never filtered — they have no
 * element to be missing.
 */
export function buildTourSteps(t: Translate, { isMobile }: BuildTourStepsOptions): DriveStep[] {
  const steps: DriveStep[] = []

  for (const anchor of STEP_ANCHORS) {
    const selector =
      isMobile && 'mobileSelector' in anchor ? anchor.mobileSelector : anchor.selector

    if (selector && !existsInDom(selector)) {
      continue
    }

    steps.push({
      element: selector ?? undefined,
      popover: {
        title: t(`steps.${anchor.id}.title`),
        description: t(`steps.${anchor.id}.description`),
      },
    })
  }

  return steps
}
