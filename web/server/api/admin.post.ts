import { sessionEmail } from '../../shared/student-id'
import {
  handleAdmin,
  ModelSettingsError,
  ProductOwnerRequiredError,
  SignInRequiredError,
} from '../admin/handle-admin'
import { createSupabaseModelSettingsStore } from '../storage/supabase-model-settings-store'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
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
      store: createSupabaseModelSettingsStore({
        url: config.public.supabaseUrl,
        secretKey: config.supabaseSecretKey,
      }),
      body: await readBody(event),
    })
  }
  catch (error) {
    if (
      error instanceof SignInRequiredError
      || error instanceof ProductOwnerRequiredError
      || error instanceof ModelSettingsError
    ) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
