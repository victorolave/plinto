/**
 * Triggers a browser "Save As" for an in-memory `Blob` — the standard trick
 * for turning a fetch response into a downloaded file without navigating
 * away from the page: a throwaway object URL, an invisible anchor with a
 * `download` attribute, one synthetic click. The object URL is revoked right
 * after so the blob isn't held in memory for the rest of the session.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
