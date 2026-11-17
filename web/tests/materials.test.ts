import { describe, expect, it } from 'vitest'
import { diagramTheme } from '../app/components/workspace/diagram-theme'
import { videoEmbed } from '../shared/materials'

describe('a video in the materials', () => {
  it('embeds a YouTube watch address', () => {
    expect(videoEmbed('https://www.youtube.com/watch?v=kqtD5dpn9C8')).toEqual({
      provider: 'youtube',
      src: 'https://www.youtube-nocookie.com/embed/kqtD5dpn9C8',
    })
  })

  it('embeds a youtu.be address', () => {
    expect(videoEmbed('https://youtu.be/kqtD5dpn9C8')).toEqual({
      provider: 'youtube',
      src: 'https://www.youtube-nocookie.com/embed/kqtD5dpn9C8',
    })
  })

  it('embeds a Vimeo address', () => {
    expect(videoEmbed('https://vimeo.com/76979871')).toEqual({
      provider: 'vimeo',
      src: 'https://player.vimeo.com/video/76979871',
    })
  })

  it('embeds a Vimeo player address', () => {
    expect(videoEmbed('https://player.vimeo.com/video/76979871')).toEqual({
      provider: 'vimeo',
      src: 'https://player.vimeo.com/video/76979871',
    })
  })

  it('does not embed an address that is not YouTube or Vimeo', () => {
    expect(videoEmbed('https://example.com/clip.mp4')).toBeNull()
  })
})

const palette: Record<string, string> = {
  '--color-paper': '#ffffff',
  '--color-ink-100': '#f3f4f6',
  '--color-ink-800': '#2a3550',
  '--color-ink-900': '#1f2a44',
  '--color-ink-950': '#141b2d',
  '--color-brand-50': '#eef5fb',
  '--color-brand-100': '#dceaf6',
  '--color-brand-300': '#a3c6e8',
  '--color-brand-500': '#4b8bbe',
  '--color-brand-800': '#244c6b',
}

function color(token: string): string {
  return palette[token] ?? ''
}

describe('a diagram theme', () => {
  it('paints a light diagram on paper and a dark diagram on ink', () => {
    expect(diagramTheme('light', color).themeVariables).toMatchObject({
      background: '#ffffff',
      primaryTextColor: '#1f2a44',
      lineColor: '#1f2a44',
    })
    expect(diagramTheme('dark', color).themeVariables).toMatchObject({
      background: '#141b2d',
      primaryTextColor: '#f3f4f6',
      lineColor: '#a3c6e8',
    })
  })

  it('asks Mermaid to fit the diagram to the width in both themes', () => {
    expect(diagramTheme('light', color).flowchart).toMatchObject({ useMaxWidth: true, htmlLabels: false })
    expect(diagramTheme('dark', color).flowchart).toMatchObject({ useMaxWidth: true, htmlLabels: false })
  })
})
