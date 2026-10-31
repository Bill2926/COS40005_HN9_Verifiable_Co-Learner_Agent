// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
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
        'codemirror',
      ],
      exclude: ['pyodide'],
    },
    worker: {
      format: 'es',
    },
  },
})
