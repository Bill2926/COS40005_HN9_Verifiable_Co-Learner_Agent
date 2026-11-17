import { sessionEmail } from '../../shared/student-id'
import {
  AdminRequestError,
  checkAdminRole,
  handleAdmin,
  isRoleCheck,
  ModelSettingsError,
  ProductOwnerRequiredError,
  SignInRequiredError,
} from '../admin/handle-admin'
import { defaultCourseId } from '../course'
import { createSupabaseDecisionLogStore } from '../storage/supabase-decision-log'
import { createSupabaseModelSettingsStore } from '../storage/supabase-model-settings-store'
import { createSupabaseVerifyShieldStore } from '../storage/supabase-verify-shield-store'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const connection = {
    url: config.public.supabaseUrl,
    secretKey: config.supabaseSecretKey,
  }
  try {
    const body = await readBody(event)
    const email = await sessionEmail(event)
    if (isRoleCheck(body)) return checkAdminRole({ email, adminEmails: config.adminEmails })
    return await handleAdmin({
      email,
      adminEmails: config.adminEmails,
      env: {
        provider: config.model,
        apiKey: config.modelApiKey,
        baseUrl: config.modelBaseUrl,
        modelName: config.modelName,
      },
      store: createSupabaseModelSettingsStore(connection),
      // The decision log of the one course there is in sprint 1.
      decisions: createSupabaseDecisionLogStore({ ...connection, courseId: defaultCourseId }),
      verifyShield: createSupabaseVerifyShieldStore(connection),
      verifyShieldEnv: config.verifyShield,
      body,
    })
  }
  catch (error) {
    if (
      error instanceof SignInRequiredError
      || error instanceof ProductOwnerRequiredError
      || error instanceof ModelSettingsError
      || error instanceof AdminRequestError
    ) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
