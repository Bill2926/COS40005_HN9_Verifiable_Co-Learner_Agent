import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { markdownReport, runBenchmark } from './run'

it('records all 25 prompt pairs and preserves their expected verdicts', async () => {
  const report = await runBenchmark()
  const directory = new URL('./results/', import.meta.url)
  await mkdir(directory, { recursive: true })
  await writeFile(new URL('latest.json', directory), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(new URL('latest.md', directory), markdownReport(report))
  console.log(`Wrote ${report.turnCount} verdicts to ${fileURLToPath(directory)}latest.{json,md}`)
  expect(report.failures).toEqual([])
})
