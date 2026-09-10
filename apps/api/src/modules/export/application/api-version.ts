import { readFileSync } from 'fs'
import { join } from 'path'

let cachedVersion: string | null = null

/**
 * The API's own `package.json` version, embedded in the household export
 * bundle so a restored dump can be traced back to the generator that
 * produced it.
 *
 * Read from disk with `fs`, not imported as a TS/JSON module: apps/api's
 * `tsconfig.json` sets `rootDir: "src"`, and importing a file outside it
 * would fight the build's `outDir` layout. `dist/` mirrors `src/` one level
 * for one level, so the number of `..` segments from this file to
 * `apps/api/package.json` is identical whether this runs from source (tests)
 * or from the compiled `dist/` (production) — see the Dockerfile's
 * `pnpm deploy --prod` step, which copies `package.json` alongside `dist/`.
 *
 * Resolved once and cached: package.json cannot change while the process is
 * running.
 */
export function getApiVersion(): string {
  if (cachedVersion !== null) {
    return cachedVersion
  }

  const packageJsonPath = join(__dirname, '../../../../package.json')
  const raw = readFileSync(packageJsonPath, 'utf-8')
  const parsed = JSON.parse(raw) as { version?: string }

  cachedVersion = parsed.version ?? '0.0.0'
  return cachedVersion
}
