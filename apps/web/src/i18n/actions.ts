'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from './config'

/**
 * Persists the user's language choice.
 *
 * A Server Action rather than a client-side `document.cookie` write, because
 * the messages for a locale are resolved on the server: writing the cookie in
 * the browser would leave the already-rendered server output in the old
 * language until something else happened to trigger a request. Writing it here
 * and revalidating means the very next render is already translated.
 */
export async function setLocale(value: string): Promise<void> {
  if (!isLocale(value)) {
    throw new Error(`Unsupported locale: ${value}`)
  }

  cookies().set(LOCALE_COOKIE, value, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    // Deliberately NOT httpOnly: this is a display preference, not a
    // credential, and keeping it readable lets a client-side render agree with
    // the server without a round trip.
    httpOnly: false,
  })

  revalidatePath('/', 'layout')
}
