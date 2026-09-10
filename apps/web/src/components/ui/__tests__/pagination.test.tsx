import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination, pageWindow } from '../pagination'
import { renderWithProviders } from '../../../test/render-with-providers'

/**
 * `pageWindow` is exported and tested apart from the component because the
 * elision rule is the only part with real logic, and asserting it through
 * rendered buttons would make an off-by-one read as a DOM failure.
 */
describe('pageWindow', () => {
  it('lists every page when they all fit', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps the first and last page reachable in one click', () => {
    const window = pageWindow(13, 26)

    expect(window[0]).toBe(1)
    expect(window[window.length - 1]).toBe(26)
  })

  it('surrounds the current page with its neighbours', () => {
    expect(pageWindow(13, 26)).toContain(12)
    expect(pageWindow(13, 26)).toContain(13)
    expect(pageWindow(13, 26)).toContain(14)
  })

  it('marks elided stretches with a gap rather than dropping them silently', () => {
    expect(pageWindow(13, 26)).toEqual([1, 'gap', 12, 13, 14, 'gap', 26])
  })

  it('does not open a gap for a single skipped page', () => {
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, 'gap', 8])
  })

  it('never emits a page outside the range', () => {
    for (const entry of pageWindow(1, 3)) {
      if (typeof entry === 'number') {
        expect(entry).toBeGreaterThanOrEqual(1)
        expect(entry).toBeLessThanOrEqual(3)
      }
    }
  })
})

describe('Pagination', () => {
  const noop = () => {}

  /**
   * A list that fits on one page has nothing to navigate, and drawing dead
   * controls under it only adds noise to the common case.
   */
  it('renders nothing when everything fits on one page', () => {
    const { container } = renderWithProviders(
      <Pagination page={1} pageSize={50} total={12} onPageChange={noop} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('reports which slice of the whole is on screen', () => {
    renderWithProviders(
      <Pagination page={1} pageSize={50} total={1284} onPageChange={noop} />,
    )

    expect(screen.getByText('1-50 of 1,284')).toBeInTheDocument()
  })

  /**
   * The last page is short. Reporting the page size rather than the real end
   * would claim rows that are not there.
   */
  it('reports the real end of a short last page', () => {
    renderWithProviders(
      <Pagination page={26} pageSize={50} total={1284} onPageChange={noop} />,
    )

    expect(screen.getByText('1,251-1,284 of 1,284')).toBeInTheDocument()
  })

  it('marks the current page for assistive technology', () => {
    renderWithProviders(
      <Pagination page={3} pageSize={10} total={100} onPageChange={noop} />,
    )

    expect(screen.getByRole('button', { name: 'Go to page 3' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('disables previous on the first page', () => {
    renderWithProviders(
      <Pagination page={1} pageSize={10} total={100} onPageChange={noop} />,
    )

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  })

  it('disables next on the last page', () => {
    renderWithProviders(
      <Pagination page={10} pageSize={10} total={100} onPageChange={noop} />,
    )

    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
  })

  it('asks for the page the reader clicked', async () => {
    const onPageChange = vi.fn()
    renderWithProviders(
      <Pagination page={1} pageSize={10} total={100} onPageChange={onPageChange} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('steps one page at a time with previous and next', async () => {
    const onPageChange = vi.fn()
    renderWithProviders(
      <Pagination page={5} pageSize={10} total={100} onPageChange={onPageChange} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }))

    expect(onPageChange).toHaveBeenNthCalledWith(1, 6)
    expect(onPageChange).toHaveBeenNthCalledWith(2, 4)
  })

  it('names itself so a screen reader can skip past it', () => {
    renderWithProviders(
      <Pagination page={1} pageSize={10} total={100} onPageChange={noop} />,
    )

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
  })
})
