import { staffLanding } from '~/staff/landing'

// Staff are never students, so opening the course sends each member of staff
// to their own page. A move within `/`, such as a layout switch, is not a
// fresh opening and is left alone.
export default defineNuxtRouteMiddleware(async (to, from) => {
  if (to.path !== '/') return
  if (import.meta.client && from.path === '/' && from.fullPath !== to.fullPath) return
  const destination = await staffLanding(useRequestFetch())
  if (destination) return navigateTo(destination, { replace: true })
})
