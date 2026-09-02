/**
 * Turns a tenant name into the filesystem/URL-safe fragment export filenames
 * use — `"Casa Olave"` becomes `"casa-olave"`, and an accented `"Ñuñoa"`
 * becomes `"nunoa"` rather than dropping the character entirely. Falls back
 * to `"household"` for a name that is entirely punctuation/emoji, so a
 * filename is never left with a double dash or a bare extension.
 */
export function slugifyTenantName(name: string): string {
  const slug = name
    .normalize('NFKD')
    // Strip combining diacritics (the accent NFKD split off, e.g. á → a + ´)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'household'
}

/** `YYYY-MM-DD`, in UTC — the export runs on a server, not in the household's own timezone. */
export function dateStamp(date: Date): string {
  return date.toISOString().slice(0, 10)
}
