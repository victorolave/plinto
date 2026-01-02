export function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) {
    return undefined
  }
  const parts = cookieHeader.split(';').map((part) => part.trim())
  const match = parts.find((part) => part.startsWith(`${name}=`))
  if (!match) {
    return undefined
  }
  return match.slice(name.length + 1)
}
