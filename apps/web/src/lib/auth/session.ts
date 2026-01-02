import { cookies } from 'next/headers'

const SESSION_COOKIE_NAME = 'plinto_session'

export function getSessionCookie() {
  return cookies().get(SESSION_COOKIE_NAME)?.value
}

export function requireSession() {
  const session = getSessionCookie()
  if (!session) {
    return null
  }
  return { token: session }
}
