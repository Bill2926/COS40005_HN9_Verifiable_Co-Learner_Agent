import { describe, expect, it } from 'vitest'
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
