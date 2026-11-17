import { isProductOwner, workspaceOptOut } from '~/admin/landing'

// Opening the course root as the product owner goes to the decisions page,
// unless the link opted out ("Back to the course"). A move within `/`, such as
// a layout switch, is not a fresh opening and is left alone.
export default defineNuxtRouteMiddleware(async (to, from) => {
  if (to.path !== '/' || to.query[workspaceOptOut] !== undefined) return
  if (import.meta.client && from.path === '/' && from.fullPath !== to.fullPath) return
  if (await isProductOwner(useRequestFetch())) return navigateTo('/admin', { replace: true })
})
