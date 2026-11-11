import type { ModelSettings } from '../model/model-choice'

export interface ModelSettingsStore {
  read(): Promise<ModelSettings | null>
  save(settings: ModelSettings): Promise<void>
}

export function createMemoryModelSettingsStore(initial: ModelSettings | null = null): ModelSettingsStore {
  let current = initial === null ? null : { ...initial }
  return {
    async read() {
      return current === null ? null : { ...current }
    },
    async save(settings) {
      current = {
        provider: settings.provider,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        modelName: settings.modelName,
      }
    },
  }
}
