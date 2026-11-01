import { sessionStudentId, studentIdFromAuth } from '#shared/student-id'

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) {
    const event = useRequestEvent()
    if (!event || !(await sessionStudentId(event))) return navigateTo('/sign-in')
    return
  }

  if (!(await studentIdFromAuth(useNuxtApp().$supabase))) return navigateTo('/sign-in')
})
