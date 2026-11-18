import { createClient } from '@supabase/supabase-js'
import { handleSignInCode, SignInCodeError } from '../auth/handle-sign-in-code'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  try {
    await handleSignInCode({
      body: await readBody(event),
      async sendCode(email) {
        const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
        if (error) throw createError({ statusCode: error.status === 429 ? 429 : 502, statusMessage: error.status === 429 ? 'Too many codes asked for. Wait a minute and try again.' : 'The code could not be sent. Try again.' })
      },
    })
    return { sent: true }
  }
  catch (error) {
    if (error instanceof SignInCodeError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
