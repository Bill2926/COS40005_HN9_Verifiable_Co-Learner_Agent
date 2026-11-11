import { sessionEmail } from '../../shared/student-id'
import {
  AdminRequestError,
  handleAdmin,
  ModelSettingsError,
  ProductOwnerRequiredError,
  SignInRequiredError,
} from '../admin/handle-admin'
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
    return await handleAdmin({
      email: await sessionEmail(event),
      adminEmails: config.adminEmails,
      env: {
        provider: config.model,
        apiKey: config.modelApiKey,
        baseUrl: config.modelBaseUrl,
        modelName: config.modelName,
      },
      store: createSupabaseModelSettingsStore(connection),
      decisions: createSupabaseDecisionLogStore(connection),
      verifyShield: createSupabaseVerifyShieldStore(connection),
      verifyShieldEnv: config.verifyShield,
      body: await readBody(event),
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
