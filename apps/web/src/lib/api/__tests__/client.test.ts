import { describe, expect, it, beforeEach, vi } from 'vitest'
import { apiFetch, apiFetchBlob, parseContentDispositionFilename } from '../client'
import { isApiError } from '../api-error'

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

describe('parseContentDispositionFilename', () => {
  it('reads a plain filename="..." form', () => {
    expect(
      parseContentDispositionFilename('attachment; filename="plinto-casa-2026-09-02.json"'),
    ).toBe('plinto-casa-2026-09-02.json')
  })

  it('reads an unquoted filename=... form', () => {
    expect(parseContentDispositionFilename('attachment; filename=report.csv')).toBe('report.csv')
  })

  it("prefers the RFC 5987 filename*=UTF-8''... form when both are present", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=\"fallback.json\"; filename*=UTF-8''plinto-caf%C3%A9-2026-09-02.json",
      ),
    ).toBe('plinto-café-2026-09-02.json')
  })

  it('returns null for a missing header', () => {
    expect(parseContentDispositionFilename(null)).toBeNull()
  })

  it('returns null when the header has no filename', () => {
    expect(parseContentDispositionFilename('attachment')).toBeNull()
  })
})

describe('apiFetch / apiFetchBlob', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com/api')
  })

  it('apiFetch returns the parsed JSON body on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: { ok: true } })))

    const result = await apiFetch<{ data: { ok: boolean } }>('/members')

    expect(result).toEqual({ data: { ok: true } })
  })

  it('apiFetch throws an ApiError carrying the code on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: 'FORBIDDEN', message: 'nope' } }, { status: 403 }),
      ),
    )

    const error = await apiFetch('/export/household').catch((caught: unknown) => caught)

    expect(isApiError(error)).toBe(true)
    expect((error as { code: string }).code).toBe('FORBIDDEN')
    expect((error as { status: number }).status).toBe(403)
  })

  it('apiFetchBlob returns the blob and the parsed filename on success', async () => {
    const body = new Blob(['hello'], { type: 'text/csv' })
    const response = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="plinto-casa-transactions-2026-09-02.csv"',
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    const result = await apiFetchBlob('/export/transactions.csv')

    expect(result.filename).toBe('plinto-casa-transactions-2026-09-02.csv')
    expect(await result.blob.text()).toBe('hello')
  })

  it('apiFetchBlob throws an ApiError on a non-ok response, same as apiFetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: 'TENANT_NOT_FOUND', message: 'gone' } }, { status: 404 }),
      ),
    )

    const error = await apiFetchBlob('/export/household').catch((caught: unknown) => caught)

    expect(isApiError(error)).toBe(true)
    expect((error as { code: string }).code).toBe('TENANT_NOT_FOUND')
  })

  it('apiFetchBlob returns null filename when the header is absent', async () => {
    const response = new Response(new Blob(['{}']), { status: 200 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    const result = await apiFetchBlob('/export/household')

    expect(result.filename).toBeNull()
  })
})
