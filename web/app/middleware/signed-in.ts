import { createRequestClient } from '#shared/supabase-server'

export default defineNuxtRouteMiddleware(async () => {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl
  const publishableKey = config.public.supabasePublishableKey
  if (!url || !publishableKey) return navigateTo('/sign-in')

  if (import.meta.server) {
    const event = useRequestEvent()
    if (!event) return navigateTo('/sign-in')
    try {
      const supabase = createRequestClient(event, url, publishableKey)
      const { data, error } = await supabase.auth.getClaims()
      if (error || !data?.claims.sub) return navigateTo('/sign-in')
    }
    catch {
      return navigateTo('/sign-in')
    }
    return
  }

  try {
    const { data, error } = await useNuxtApp().$supabase.auth.getClaims()
    if (error || !data?.claims.sub) return navigateTo('/sign-in')
  }
  catch {
    return navigateTo('/sign-in')
  }
})
