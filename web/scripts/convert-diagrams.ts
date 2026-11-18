// One-off: turns every diagram block in a course's published spec and draft into
// an image block. Each diagram is rendered to a light-theme PNG with Mermaid
// CLI, uploaded to the course-images bucket, and replaced by an image block
// with alt text written from its source. The published change goes through
// import_course_spec, so it shows in the course history.
//
// Run locally, before deploying the build that removes the diagram block:
//   NUXT_PUBLIC_SUPABASE_URL=… NUXT_SUPABASE_SECRET_KEY=… [CHROMIUM_PATH=…] \
//     node --experimental-strip-types scripts/convert-diagrams.ts [--dry-run]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { altTextFromMermaid } from './diagram-alt-text.ts'

const url = process.env.NUXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.NUXT_SUPABASE_SECRET_KEY
if (!url || !secretKey) throw new Error('Set NUXT_PUBLIC_SUPABASE_URL and NUXT_SUPABASE_SECRET_KEY.')
const dryRun = process.argv.includes('--dry-run')
const courseId = 'intro_python'
const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
const work = mkdtempSync(join(tmpdir(), 'diagrams-'))
const mermaidCli = fileURLToPath(new URL('../node_modules/@mermaid-js/mermaid-cli/src/cli.js', import.meta.url))

interface Block { type: string, mermaid?: string, url?: string, alt?: string }
interface Spec { modules: { content?: { materials: Block[] } }[] }

function render(source: string): Buffer {
  const input = join(work, 'diagram.mmd')
  const output = join(work, 'diagram.png')
  writeFileSync(input, source)
  const config = join(work, 'puppeteer.json')
  writeFileSync(config, JSON.stringify({
    args: ['--no-sandbox'],
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  }))
  // Runs Mermaid CLI's entry file with this Node, since Windows cannot spawn npx directly.
  execFileSync(process.execPath, [mermaidCli, '-i', input, '-o', output, '-t', 'default', '-b', 'white', '-s', '2', '-p', config], { stdio: 'inherit' })
  return readFileSync(output)
}

async function convert(spec: Spec): Promise<number> {
  let converted = 0
  for (const module of spec.modules) {
    const materials = module.content?.materials
    if (!materials) continue
    for (const [index, block] of materials.entries()) {
      if (block.type !== 'diagram' || !block.mermaid) continue
      const alt = altTextFromMermaid(block.mermaid)
      let imageUrl = 'dry-run'
      if (!dryRun) {
        const path = `${courseId}/${crypto.randomUUID()}.png`
        const png = render(block.mermaid)
        const upload = await supabase.storage.from('course-images').upload(path, png, { contentType: 'image/png' })
        if (upload.error) throw new Error(upload.error.message)
        imageUrl = supabase.storage.from('course-images').getPublicUrl(path).data.publicUrl
      }
      materials[index] = { type: 'image', url: imageUrl, alt }
      console.log(`${dryRun ? 'would convert' : 'converted'}: ${alt}`)
      converted += 1
    }
  }
  return converted
}

const course = await supabase.from('courses').select('owner_email, spec, draft').eq('id', courseId).single()
if (course.error) throw new Error(course.error.message)

const spec = course.data.spec as Spec
if (await convert(spec) > 0 && !dryRun) {
  const published = await supabase.rpc('import_course_spec', { lecturer_email: course.data.owner_email, new_spec: spec })
  if (published.error || published.data !== true) throw new Error(published.error?.message ?? 'The course spec was not published.')
  console.log('published the converted course spec')
}
if (course.data.draft) {
  const draft = course.data.draft as Spec
  if (await convert(draft) > 0 && !dryRun) {
    const saved = await supabase.from('courses').update({ draft }).eq('id', courseId)
    if (saved.error) throw new Error(saved.error.message)
    console.log('saved the converted draft')
  }
}
