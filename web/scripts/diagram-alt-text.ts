// Alt text for a converted diagram, written from its Mermaid source: each
// arrow in a flowchart becomes a sentence, so a screen reader hears the steps.
const arrow = /^\s*([A-Za-z0-9_]+)(?:\[(?:"([^"]*)"|([^\]]*))\])?\s*-->(?:\|([^|]*)\|)?\s*([A-Za-z0-9_]+)(?:\[(?:"([^"]*)"|([^\]]*))\])?\s*$/

export function altTextFromMermaid(source: string): string {
  const labels = new Map<string, string>()
  const steps: string[] = []
  for (const line of source.split('\n').slice(1)) {
    const match = arrow.exec(line)
    if (!match) continue
    const [, from, fromQuoted, fromPlain, via, to, toQuoted, toPlain] = match
    const fromLabel = fromQuoted ?? fromPlain
    const toLabel = toQuoted ?? toPlain
    if (fromLabel) labels.set(from!, fromLabel)
    if (toLabel) labels.set(to!, toLabel)
    steps.push(`${labels.get(from!) ?? from} leads to ${labels.get(to!) ?? to}${via ? ` (${via.trim()})` : ''}`)
  }
  if (steps.length === 0) throw new Error('The diagram has no arrows to describe.')
  return `Diagram: ${steps.join('; ')}.`
}
