import { createClient } from '@supabase/supabase-js'
import type { ModelSettings } from '../language-model'
import type { ModelSettingsStore } from './model-settings-store'

export function createSupabaseModelSettingsStore(options: {
  url: string
  secretKey: string
}): ModelSettingsStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async read() {
      const result = await supabase
        .from('model_settings')
        .select('provider, api_key, base_url, model_name')
        .eq('id', 1)
        .maybeSingle()
      if (result.error) throw new Error(result.error.message)
      if (!result.data) return null
      return {
        provider: result.data.provider,
        apiKey: result.data.api_key,
        baseUrl: result.data.base_url,
        modelName: result.data.model_name,
      }
    },
    async save(settings: ModelSettings) {
      const result = await supabase.from('model_settings').upsert({
        id: 1,
        provider: settings.provider,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.modelName,
      }, { onConflict: 'id' })
      if (result.error) throw new Error(result.error.message)
    },
  }
}
