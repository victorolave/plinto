// PLINTO · LANDING — motion (Capa 1: universal base)
// ============================================================
// Progressive enhancement only. No dependencies. Never writes
// `transform`, `opacity` or any visual property directly — only an
// attribute (`data-reveal="in"`, `data-scrub-active`) or a custom
// property (`--progress`). Every visual rule lives in motion.css.
//
// `html.has-motion` is the no-JS safety gate: motion.css only hides
// or transforms elements underneath that selector. This script is
// the only thing that ever adds it, so with JavaScript disabled (or
// this file failing to load) every `[data-reveal]` / `[data-scrub]`
// element simply keeps rendering at the plain, final state the
// design already defines — nothing depends on JS to become visible.
//
// Capa 2 (native `animation-timeline`, see motion.css) does its own
// work purely in CSS once `has-motion` is present — this module gets
// out of the way for reveals and scrub the moment it detects support.

function initReveals(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
  if (els.length === 0) return

  const io = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.setAttribute('data-reveal', 'in')
        observer.unobserve(entry.target)
      }
    },
    // A FIXED offset, not a percentage. With '-12%' the effective bottom edge
    // scales with the viewport, so an element anchored to the end of the
    // document could sit permanently below it and never intersect: the footer's
    // legal line stayed at opacity 0 forever at 1440x800 and 390x844, but
    // revealed fine at 390x667. A constant cannot depend on window height, so
    // the bug cannot come back on a screen nobody tested.
    { rootMargin: '0px 0px -40px 0px', threshold: 0 },
  )

  for (const el of els) io.observe(el)
}

function initScrub(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-scrub]')
  if (els.length === 0) return

  const active = new Set<HTMLElement>()

  function update(): void {
    if (active.size === 0) return
    const vh = window.innerHeight

    // Read every rect first, then write every custom property — never
    // interleave reads and writes, that is layout thrashing.
    const rects = new Map<HTMLElement, DOMRect>()
    for (const el of active) rects.set(el, el.getBoundingClientRect())

    for (const [el, rect] of rects) {
      const span = rect.height + vh
      const raw = span > 0 ? (vh - rect.top) / span : 0
      const progress = Math.min(1, Math.max(0, raw))
      el.style.setProperty('--progress', progress.toFixed(4))
    }
  }

  let ticking = false
  function onScroll(): void {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      update()
    })
  }

  const activity = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement
        if (entry.isIntersecting) {
          active.add(el)
          el.setAttribute('data-scrub-active', '')
        } else {
          active.delete(el)
          el.removeAttribute('data-scrub-active')
        }
      }
      update()
    },
    { rootMargin: '20% 0px 20% 0px', threshold: 0 },
  )

  for (const el of els) activity.observe(el)
  window.addEventListener('scroll', onScroll, { passive: true })
}

function main(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // Everything below this line only ever touches elements nested
  // under `html.has-motion` — see motion.css.
  document.documentElement.classList.add('has-motion')

  if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()')) {
    return // la capa 2 (nativa) se encarga
  }

  initReveals()
  initScrub()
}

main()
