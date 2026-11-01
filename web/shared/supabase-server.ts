import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { appendHeader, getHeader, setHeader, type H3Event } from 'h3'

export function createRequestClient(event: H3Event, url: string, publishableKey: string) {
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(getHeader(event, 'Cookie') ?? '')
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value, options }) => {
          appendHeader(event, 'Set-Cookie', serializeCookieHeader(name, value, options))
        })
        Object.entries(cacheHeaders).forEach(([key, value]) => {
          setHeader(event, key, value)
        })
      },
    },
  })
}
