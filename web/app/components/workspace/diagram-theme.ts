import type { MermaidConfig } from 'mermaid'

// Diagram colours are palette variables from main.css. Light sits on paper
// with navy ink. Dark uses the ink and brand steps so a diagram stays
// readable if a dark theme is on. The app itself stays light
// (see docs/agents/palette.md). Mermaid needs a resolved colour, so the
// caller reads each variable from the page.
const fit = { useMaxWidth: true, htmlLabels: false }

export function diagramTheme(mode: 'light' | 'dark', color: (token: string) => string): MermaidConfig {
  const dark = mode === 'dark'
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: 'Inter, sans-serif',
    flowchart: fit,
    themeVariables: dark
      ? {
          background: color('--color-ink-950'),
          primaryColor: color('--color-brand-800'),
          primaryTextColor: color('--color-ink-100'),
          primaryBorderColor: color('--color-brand-300'),
          lineColor: color('--color-brand-300'),
          secondaryColor: color('--color-ink-900'),
          tertiaryColor: color('--color-ink-800'),
          textColor: color('--color-ink-100'),
          mainBkg: color('--color-brand-800'),
          nodeTextColor: color('--color-ink-100'),
        }
      : {
          background: color('--color-paper'),
          primaryColor: color('--color-brand-50'),
          primaryTextColor: color('--color-ink-900'),
          primaryBorderColor: color('--color-brand-500'),
          lineColor: color('--color-ink-900'),
          secondaryColor: color('--color-ink-100'),
          tertiaryColor: color('--color-brand-100'),
          textColor: color('--color-ink-900'),
          mainBkg: color('--color-brand-50'),
          nodeTextColor: color('--color-ink-900'),
        },
  }
}
