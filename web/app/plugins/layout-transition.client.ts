// Switching the workspace between Study and Mindmap keeps the same page, so
// Nuxt's own view transition skips it. This one crossfades that switch without
// remounting a panel, so drafts, the editor and the conversation survive.
export default defineNuxtPlugin(() => {
  if (typeof document.startViewTransition !== 'function') return
  const router = useRouter()

  router.beforeResolve((to, from) => {
    if (to.path !== '/' || from.path !== '/') return
    if (!from.query.layout || to.query.layout === from.query.layout) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    return new Promise<void>((proceed) => {
      const transition = document.startViewTransition(() => new Promise<void>((settle) => {
        // afterEach also runs when the navigation fails, so the snapshot never hangs.
        const stop = router.afterEach(() => {
          stop()
          nextTick(() => settle())
        })
        proceed()
      }))
      transition.ready.catch(() => {})
      transition.finished.catch(() => {})
    })
  })
})
