import { resolveWorkspaceLayout, workspaceLayoutCookie, workspaceLayoutCookieOptions } from '~/workspace/layout'

// A missing layout is written into the current history entry on the client, so
// Back returns to the layout that was showing. The server still renders `/`
// itself, from the remembered layout, with no redirect.
export default defineNuxtRouteMiddleware((to) => {
  const remembered = useCookie<string | null>(workspaceLayoutCookie, workspaceLayoutCookieOptions)
  if (import.meta.server || to.path !== '/' || to.query.layout !== undefined) return
  const layout = resolveWorkspaceLayout(undefined, remembered.value)
  return navigateTo({
    path: to.path,
    query: { ...to.query, layout },
  }, { replace: true })
})
