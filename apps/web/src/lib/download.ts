/**
 * Triggers a browser "Save As" for an in-memory `Blob` — the standard trick
 * for turning a fetch response into a downloaded file without navigating
 * away from the page: a throwaway object URL, an invisible anchor with a
 * `download` attribute, one synthetic click. The object URL is revoked on the
 * next tick so the blob isn't held in memory for the rest of the session —
 * deferred, not synchronous, because some browsers start the download
 * asynchronously after the click and a synchronous revoke can cancel it.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
