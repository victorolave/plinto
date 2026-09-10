/** @vitest-environment jsdom */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildTourSteps } from '../tour-steps'

const t = (key: string) => key

/**
 * jsdom performs no real layout: `HTMLElement.prototype.offsetParent` is
 * hardcoded to `null` and `getClientRects()` to `[]` for every element,
 * visible or not (see jsdom's HTMLElement-impl.js). Real browsers use those
 * two together (see tour-steps.ts's `isVisible`) to tell a rendered element
 * apart from one sitting behind `display:none` — this polyfills
 * `offsetParent` for the duration of this file only, so the same
 * production code can actually be exercised against a hidden-vs-visible
 * DOM instead of always seeing "nothing is visible."
 */
let originalOffsetParent: PropertyDescriptor | undefined

beforeAll(() => {
  originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      let el: HTMLElement | null = this
      while (el) {
        if (window.getComputedStyle(el).display === 'none') return null
        el = el.parentElement
      }
      return document.body
    },
  })
})

afterAll(() => {
  if (originalOffsetParent) {
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', originalOffsetParent)
  }
})

function addAnchor(dataTour: string, { hidden = false }: { hidden?: boolean } = {}) {
  const el = document.createElement('div')
  el.setAttribute('data-tour', dataTour)
  if (hidden) el.style.display = 'none'
  document.body.appendChild(el)
  return el
}

/** The element a step's resolver actually points at (steps use a `() =>
 * Element` resolver, never a raw selector string — see tour-steps.ts). */
function resolvedElement(step: { element?: unknown }): Element | undefined {
  return typeof step.element === 'function' ? (step.element as () => Element)() : undefined
}

describe('buildTourSteps', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('always keeps the centered welcome step, which has no element', () => {
    const steps = buildTourSteps(t, { isMobile: false })

    expect(steps[0]).toEqual({
      element: undefined,
      popover: { title: 'steps.welcome.title', description: 'steps.welcome.description' },
    })
  })

  it('drops an anchored step whose element is not in the DOM at all', () => {
    const steps = buildTourSteps(t, { isMobile: false })

    expect(steps.some((step) => step.popover?.title === 'steps.accounts.title')).toBe(false)
  })

  it('drops an anchored step whose only matching element is hidden (display:none)', () => {
    addAnchor('nav-debts', { hidden: true })

    const steps = buildTourSteps(t, { isMobile: false })

    expect(steps.some((step) => step.popover?.title === 'steps.debts.title')).toBe(false)
  })

  it('keeps an anchored step once a visible element exists', () => {
    const el = addAnchor('nav-debts')

    const steps = buildTourSteps(t, { isMobile: false })
    const step = steps.find((s) => s.popover?.title === 'steps.debts.title')

    expect(step).toBeDefined()
    expect(resolvedElement(step!)).toBe(el)
  })

  it('skips the first-steps step when the card is not rendered', () => {
    const steps = buildTourSteps(t, { isMobile: false })

    expect(steps.some((step) => step.popover?.title === 'steps.firstSteps.title')).toBe(false)
  })

  it('keeps the first-steps step when the card is present', () => {
    addAnchor('first-steps')

    const steps = buildTourSteps(t, { isMobile: false })

    expect(steps.some((step) => step.popover?.title === 'steps.firstSteps.title')).toBe(true)
  })

  it('centers the household step on mobile instead of anchoring it', () => {
    addAnchor('tenant-switcher')

    const desktopSteps = buildTourSteps(t, { isMobile: false })
    const mobileSteps = buildTourSteps(t, { isMobile: true })

    const desktopStep = desktopSteps.find((s) => s.popover?.title === 'steps.household.title')
    const mobileStep = mobileSteps.find((s) => s.popover?.title === 'steps.household.title')

    expect(typeof desktopStep?.element).toBe('function')
    expect(mobileStep?.element).toBeUndefined()
  })

  it('centers obligations/debts/credit/categories on mobile instead of the hidden sidebar link', () => {
    addAnchor('nav-obligations')
    addAnchor('nav-debts')
    addAnchor('nav-credit')
    addAnchor('nav-categories')

    const mobileSteps = buildTourSteps(t, { isMobile: true })

    for (const id of ['obligations', 'debts', 'credit', 'categories']) {
      const step = mobileSteps.find((s) => s.popover?.title === `steps.${id}.title`)
      expect(step, `expected a centered "${id}" step on mobile`).toBeDefined()
      expect(step!.element).toBeUndefined()
    }
  })

  it('picks the visible one of two elements sharing a data-tour value (accounts/transactions)', () => {
    const hiddenSidebarLink = addAnchor('nav-accounts', { hidden: true })
    const visibleBottomNavLink = addAnchor('nav-accounts')

    const steps = buildTourSteps(t, { isMobile: true })
    const step = steps.find((s) => s.popover?.title === 'steps.accounts.title')

    expect(step).toBeDefined()
    expect(resolvedElement(step!)).toBe(visibleBottomNavLink)
    expect(resolvedElement(step!)).not.toBe(hiddenSidebarLink)
  })

  it('drops accounts/transactions on mobile when every matching element is hidden', () => {
    addAnchor('nav-transactions', { hidden: true })

    const mobileSteps = buildTourSteps(t, { isMobile: true })

    expect(mobileSteps.some((s) => s.popover?.title === 'steps.transactions.title')).toBe(false)
  })

  it('anchors the help step to the sidebar Help link on desktop', () => {
    const desktopHelp = addAnchor('nav-help')

    const desktopSteps = buildTourSteps(t, { isMobile: false })
    const desktopStep = desktopSteps.find((s) => s.popover?.title === 'steps.help.title')

    expect(resolvedElement(desktopStep!)).toBe(desktopHelp)
  })

  it('drops the help step on desktop when the sidebar Help link is not in the DOM', () => {
    const mobileSteps = buildTourSteps(t, { isMobile: false })

    expect(mobileSteps.some((s) => s.popover?.title === 'steps.help.title')).toBe(false)
  })

  it('centers the help step on mobile instead of anchoring it — Help only lives inside the "More" sheet there', () => {
    addAnchor('nav-help')

    const mobileSteps = buildTourSteps(t, { isMobile: true })
    const mobileStep = mobileSteps.find((s) => s.popover?.title === 'steps.help.title')

    expect(mobileStep).toBeDefined()
    expect(mobileStep!.element).toBeUndefined()
  })

  it('keeps the centered help step on mobile even without the "More" sheet open (its anchor absent from the DOM)', () => {
    const mobileSteps = buildTourSteps(t, { isMobile: true })

    expect(mobileSteps.some((s) => s.popover?.title === 'steps.help.title')).toBe(true)
  })
})
