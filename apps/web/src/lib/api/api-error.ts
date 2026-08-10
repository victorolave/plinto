/**
 * An error the API reported, with its machine-readable `code` preserved.
 *
 * The client used to throw `new Error(error.error.message)` — it kept the
 * English prose the backend wrote and dropped the `code` beside it. That made
 * the backend's wording the user-facing copy, which is why the API's contract
 * and the app's language got welded together.
 *
 * Extending `Error` on purpose: every existing `error instanceof Error ?
 * error.message : …` call site keeps working untouched, and gets a translated
 * message only once it opts in via `useErrorMessage`.
 */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown
  readonly traceId?: string

  constructor(init: {
    code: string
    message: string
    status: number
    details?: unknown
    traceId?: string
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.code = init.code
    this.status = init.status
    this.details = init.details
    this.traceId = init.traceId
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
