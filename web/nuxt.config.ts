// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  runtimeConfig: {
    supabaseSecretKey: '',
    // real is the OpenAI-compatible client. DeepSeek is that client with
    // base URL https://api.deepseek.com. A saved record on /admin replaces these.
    model: 'real',
    modelApiKey: '',
    modelBaseUrl: 'https://api.deepseek.com',
    modelName: 'deepseek-flash',
    adminEmails: 'owner@example.com',
    public: {
      supabaseUrl: '',
      supabasePublishableKey: '',
    },
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
        },
      ],
    },
  },
  colorMode: {
    preference: 'light',
    fallback: 'light',
    // Don't reuse a dark preference saved by another app on localhost.
    storageKey: 'colearner-color-mode',
  },
  vite: {
    optimizeDeps: {
      include: [
        '@codemirror/lang-python',
        '@codemirror/language',
        '@codemirror/state',
        '@lezer/highlight',
        'codemirror',
      ],
      exclude: ['pyodide'],
    },
    worker: {
      format: 'es',
    },
  },
})
