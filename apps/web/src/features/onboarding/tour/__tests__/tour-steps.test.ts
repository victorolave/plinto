/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { buildTourSteps } from '../tour-steps'

const t = (key: string) => key

function addAnchor(dataTour: string) {
  const el = document.createElement('div')
  el.setAttribute('data-tour', dataTour)
  document.body.appendChild(el)
  return el
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

  it('drops an anchored step whose element is not in the DOM', () => {
    const steps = buildTourSteps(t, { isMobile: false })

    expect(steps.find((step) => step.element === '[data-tour="nav-accounts"]')).toBeUndefined()
  })

  it('keeps an anchored step once its element exists', () => {
    addAnchor('nav-accounts')

    const steps = buildTourSteps(t, { isMobile: false })

    expect(steps.find((step) => step.element === '[data-tour="nav-accounts"]')).toEqual({
      element: '[data-tour="nav-accounts"]',
      popover: { title: 'steps.accounts.title', description: 'steps.accounts.description' },
    })
  })

  it('skips the first-steps step when the card is not rendered', () => {
    const steps = buildTourSteps(t, { isMobile: false })

    expect(steps.some((step) => step.element === '[data-tour="first-steps"]')).toBe(false)
  })

  it('keeps the first-steps step when the card is present', () => {
    addAnchor('first-steps')

    const steps = buildTourSteps(t, { isMobile: false })

    expect(steps.some((step) => step.element === '[data-tour="first-steps"]')).toBe(true)
  })

  it('centers the household step on mobile instead of anchoring it', () => {
    addAnchor('tenant-switcher')

    const desktopSteps = buildTourSteps(t, { isMobile: false })
    const mobileSteps = buildTourSteps(t, { isMobile: true })

    expect(desktopSteps.find((s) => s.popover?.title === 'steps.household.title')).toEqual({
      element: '[data-tour="tenant-switcher"]',
      popover: { title: 'steps.household.title', description: 'steps.household.description' },
    })
    expect(mobileSteps.find((s) => s.popover?.title === 'steps.household.title')).toEqual({
      element: undefined,
      popover: { title: 'steps.household.title', description: 'steps.household.description' },
    })
  })

  it('points the help step at the mobile anchor on small screens', () => {
    addAnchor('help-button')
    addAnchor('help-more-item')

    const desktopSteps = buildTourSteps(t, { isMobile: false })
    const mobileSteps = buildTourSteps(t, { isMobile: true })

    expect(desktopSteps.find((s) => s.popover?.title === 'steps.help.title')?.element).toBe(
      '[data-tour="help-button"]',
    )
    expect(mobileSteps.find((s) => s.popover?.title === 'steps.help.title')?.element).toBe(
      '[data-tour="help-more-item"]',
    )
  })

  it('drops the help step on mobile when the more-sheet item is not in the DOM', () => {
    // Only the desktop anchor exists.
    addAnchor('help-button')

    const mobileSteps = buildTourSteps(t, { isMobile: true })

    expect(mobileSteps.some((s) => s.popover?.title === 'steps.help.title')).toBe(false)
  })
})
