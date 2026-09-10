/**
 * The catalogue checks, as functions instead of assertions.
 *
 * ── Why this is a module and not just a test ─────────────────────────────
 * These rules used to live inside `messages.test.ts`, which meant the only way
 * to know they actually bite was to break the real `es.json`, run the suite,
 * and put the file back. That ritual works once, by hand, and proves nothing
 * afterwards — the next person to weaken a check has no way to notice.
 *
 * Pulled out here, the checker is itself testable: `catalogue-audit.test.ts`
 * feeds it deliberately broken catalogues and asserts each fault is reported.
 * The guard is now guarded, and no real file is ever touched.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type Catalogue = Record<string, unknown>

/** Every leaf path in a nested catalogue, as `a.b.c`. */
export function flattenKeys(value: Catalogue, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? flattenKeys(child as Catalogue, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

/** The message at `path`, or `undefined` when the path leads nowhere. */
export function readMessage(catalogue: Catalogue, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>((node, segment) => (node as Catalogue)?.[segment], catalogue)

  return typeof value === 'string' ? value : undefined
}

/**
 * The argument names a message needs — `{name}` and `{count, plural, …}`
 * alike. Two languages must agree on these or one of them renders a
 * placeholder the caller never passes.
 */
export function placeholdersOf(message: string): string[] {
  return [...message.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*(?:,[^}]*)?\}/g)]
    .map((match) => match[1])
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort()
}

export interface AuditInput {
  /** Every catalogue to check, keyed by locale. */
  catalogues: Record<string, Catalogue>
  /** The locale whose key set the others are measured against. */
  reference: string
  /** Validation codes that must resolve in every language. */
  requiredCodes?: readonly string[]
}

/**
 * Returns one human-readable line per fault, empty when the catalogues are
 * sound. A list rather than a thrown error so a caller can report every
 * problem at once instead of the first — a translator fixing ten keys should
 * see ten, not run the suite ten times.
 */
export function auditCatalogues({
  catalogues,
  reference,
  requiredCodes = [],
}: AuditInput): string[] {
  const problems: string[] = []

  const referenceCatalogue = catalogues[reference]
  if (!referenceCatalogue) {
    return [`reference locale "${reference}" is not among the catalogues`]
  }

  const referenceKeys = flattenKeys(referenceCatalogue)

  for (const [locale, catalogue] of Object.entries(catalogues)) {
    const keys = new Set(flattenKeys(catalogue))

    for (const key of referenceKeys) {
      if (!keys.has(key)) {
        problems.push(`${locale} is missing ${key}`)
        continue
      }

      const message = readMessage(catalogue, key)
      if (message === undefined || message === '') {
        problems.push(`${locale} → ${key} is empty`)
        continue
      }

      const expected = placeholdersOf(readMessage(referenceCatalogue, key) ?? '')
      const actual = placeholdersOf(message)
      if (expected.join(',') !== actual.join(',')) {
        problems.push(
          `${locale} → ${key} expects [${expected.join(', ')}] but has [${actual.join(', ')}]`,
        )
      }
    }

    for (const key of keys) {
      if (!referenceKeys.includes(key)) {
        problems.push(`${locale} has ${key}, which ${reference} does not`)
      }
    }
  }

  // Codes come from `@plinto/shared`, so a rule added there without a
  // translation here is reported by name rather than discovered by a user.
  for (const code of requiredCodes) {
    for (const [locale, catalogue] of Object.entries(catalogues)) {
      const message = readMessage(catalogue, `validation.${code}`)
      if (message === undefined || message === '') {
        problems.push(`${locale} has no translation for validation code ${code}`)
      }
    }
  }

  return problems
}
