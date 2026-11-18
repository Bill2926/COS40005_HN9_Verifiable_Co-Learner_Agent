import type { MaterialBlock, ModuleMaterials } from './turn'

// One entry per block type, so a type added to MaterialBlock does not compile until it is given one.
const blockText: { [Type in MaterialBlock['type']]: (block: Extract<MaterialBlock, { type: Type }>) => string } = {
  text: block => block.markdown,
  code: block => block.code,
  image: block => `${block.alt} (${block.url})`,
  video: block => `${block.title} (${block.url})`,
}

export function materialsText(materials: ModuleMaterials): string {
  return materials.map(block => (blockText[block.type] as (block: MaterialBlock) => string)(block)).join('\n\n')
}

// YouTube and Vimeo play inside the materials. Any other address stays a link.
export function videoEmbed(url: string): { provider: 'youtube' | 'vimeo', src: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0]
    return id ? { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` } : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const parts = parsed.pathname.split('/').filter(Boolean)
    const id = parsed.searchParams.get('v')
      || ((parts[0] === 'embed' || parts[0] === 'shorts') ? parts[1] : '')
    return id ? { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` } : null
  }
  if (host === 'player.vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean)[1]
    return id && /^\d+$/.test(id) ? { provider: 'vimeo', src: `https://player.vimeo.com/video/${id}` } : null
  }
  if (host === 'vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean).reverse().find(part => /^\d+$/.test(part))
    return id ? { provider: 'vimeo', src: `https://player.vimeo.com/video/${id}` } : null
  }
  return null
}
