import type { RoadmapModule } from '#shared/turn'

// A point is where a card sits within the room it can move in:
// 0 is the canvas's left or top edge, 1 puts the card flush with the right or bottom edge.
// Points therefore keep every card inside the canvas at any canvas size.
export interface Point {
  x: number
  y: number
}

export type Arrangement = Record<string, Point>

export interface Size {
  width: number
  height: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export type SizeClass = 'wide' | 'compact'

export type ConnectorKind = 'mastered' | 'current' | 'closed'

export interface Connector {
  from: string
  to: string
  kind: ConnectorKind
  path: string
}

const prefix = 'co-learner-roadmap-arrangement:'
const earlierPrefix = 'co-learner-map-arrangement:'

export interface ArrangementStore {
  read: () => Arrangement
  write: (arrangement: Arrangement) => void
  clear: () => void
}

export function createArrangementStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  studentId: string,
  sizeClass: SizeClass,
): ArrangementStore {
  const key = `${prefix}${studentId}:${sizeClass}`
  const earlierKey = `${earlierPrefix}${studentId}:${sizeClass}`

  return {
    read() {
      const raw = storage.getItem(key) ?? storage.getItem(earlierKey)
      if (!raw) return {}
      try {
        return validArrangement(JSON.parse(raw))
      }
      catch {
        return {}
      }
    },
    write(arrangement) {
      storage.setItem(key, JSON.stringify(arrangement))
    },
    clear() {
      storage.removeItem(key)
      storage.removeItem(earlierKey)
    },
  }
}

// A saved point outside 0–1, or one that is not a finite number, is dropped.
// That module keeps the starting arrangement.
function validArrangement(value: unknown): Arrangement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const arrangement: Arrangement = {}
  for (const [id, point] of Object.entries(value)) {
    if (!point || typeof point !== 'object' || Array.isArray(point)) continue
    const { x, y } = point as Record<string, unknown>
    if (typeof x !== 'number' || typeof y !== 'number') continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (x < 0 || x > 1 || y < 0 || y > 1) continue
    arrangement[id] = { x, y }
  }
  return arrangement
}

export function mergeArrangement(starting: Arrangement, saved: Arrangement): Arrangement {
  const arrangement: Arrangement = { ...starting }
  for (const [id, point] of Object.entries(saved)) {
    if (!(id in arrangement)) continue
    arrangement[id] = point
  }
  return arrangement
}

export function sizeClassOf(canvas: Size): SizeClass {
  return canvas.width >= 1024 && canvas.height >= 560 ? 'wide' : 'compact'
}

const typicalCard: Size = { width: 248, height: 176 }
// The current module is the widest and tallest card. A compact canvas lays out
// around that size, so a shorter card still has a gap.
const compactCard: Size = { width: 248, height: 112 }
const edge = 16
const labelRoom = 64
const footerRoom = 56
// The Roadmap canvas floats the working area at the bottom left and the
// conversation at the top right. Wide layouts keep module cards out of both.
const wideConversationReserve = 360 + edge
const wideWorkingReserve = 448 + edge

// Shrinks the compact card so every row fits between the label and the pill.
// A sideways phone is a short canvas; full-size cards would stack.
export function arrangementScale(canvas: Size, count: number): number {
  if (count === 0) return 1
  if (sizeClassOf(canvas) === 'wide') return wideScale(canvas, count)
  const topRoom = canvas.width < 480 ? 96 : labelRoom
  const bottomRoom = canvas.width < 768 ? 80 : footerRoom
  const columns = compactColumns(canvas, count)
  const rows = Math.ceil(count / columns)
  const stagger = columns > 1 ? 16 : 0
  const roomHeight = Math.max(0, canvas.height - topRoom - bottomRoom)
  const roomWidth = Math.max(0, canvas.width - edge * 2)
  const heightScale = (roomHeight - stagger) / (rows * compactCard.height)
  const widthScale = roomWidth / compactCard.width
  return Math.min(1, Math.max(0, heightScale), Math.max(0, widthScale))
}

export function fittedModuleWidth(canvas: Size, count: number): number {
  const width = sizeClassOf(canvas) === 'wide' ? typicalCard.width : compactCard.width
  return width * arrangementScale(canvas, count)
}

function wideScale(canvas: Size, count: number): number {
  const freeWidth = Math.max(typicalCard.width, canvas.width - edge * 2 - wideConversationReserve)
  const freeHeight = Math.max(typicalCard.height, canvas.height - labelRoom - wideWorkingReserve)
  const columns = Math.max(1, Math.min(count, Math.floor(freeWidth / (typicalCard.width + 16))))
  const rows = Math.ceil(count / columns)
  const heightScale = freeHeight / (rows * typicalCard.height)
  const widthScale = freeWidth / (columns * (typicalCard.width + 16))
  return Math.min(1, Math.max(0, heightScale), Math.max(0, widthScale))
}

function compactColumns(canvas: Size, count: number): number {
  return Math.max(1, Math.min(count, Math.floor((canvas.width - edge * 2) / (compactCard.width + 24))))
}

export function defaultArrangement(moduleIds: readonly string[], canvas: Size): Arrangement {
  const flowed = flow(moduleIds.length, canvas)
  const arrangement: Arrangement = {}
  moduleIds.forEach((id, index) => {
    arrangement[id] = flowed[index] ?? { x: 0, y: 0 }
  })
  return arrangement
}

// Course order runs left to right, snaking back on the next row; one column zig-zags.
function flow(count: number, canvas: Size): Point[] {
  if (count === 0) return []
  const compact = sizeClassOf(canvas) !== 'wide'
  const scale = arrangementScale(canvas, count)
  const card = compact
    ? { width: compactCard.width * scale, height: compactCard.height * scale }
    : { width: typicalCard.width * scale, height: typicalCard.height * scale }
  const topRoom = compact && canvas.width < 480 ? 96 : labelRoom
  const bottomRoom = compact
    ? (canvas.width < 768 ? 80 : footerRoom)
    : wideWorkingReserve
  const columns = compact
    ? compactColumns(canvas, count)
    : Math.max(1, Math.min(count, Math.floor((canvas.width - edge * 2 - wideConversationReserve) / (card.width + 16))))
  const rows = Math.ceil(count / columns)
  const stagger = compact && columns > 1 ? 16 : 0
  const usableHeight = Math.max(0, canvas.height - topRoom - bottomRoom - card.height - stagger)
  const step = rows > 1 ? Math.min(card.height + 40, usableHeight / (rows - 1)) : 0
  const cell = (canvas.width - edge * 2) / columns

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns)
    const inRow = index % columns
    const column = row % 2 === 0 ? inRow : columns - 1 - inRow
    const left = columns === 1
      ? (index % 2 === 0 ? edge : canvas.width - card.width - edge)
      : edge + column * cell + (cell - card.width) / 2
    const top = topRoom + row * step + (columns > 1 && column % 2 === 1 ? 16 : 0)
    return pointAt(left, top, card, canvas)
  })
}

export function placeCard(point: Point, card: Size, canvas: Size): Box {
  return {
    x: unit(point.x) * room(canvas.width, card.width),
    y: unit(point.y) * room(canvas.height, card.height),
    width: card.width,
    height: card.height,
  }
}

export function pointAt(left: number, top: number, card: Size, canvas: Size): Point {
  const roomX = room(canvas.width, card.width)
  const roomY = room(canvas.height, card.height)
  return {
    x: roomX === 0 ? 0 : unit(left / roomX),
    y: roomY === 0 ? 0 : unit(top / roomY),
  }
}

// Moves a card the shortest way out from under any obstacle, staying inside the canvas.
// Leaves it where it is when no such spot exists.
export function avoid(box: Box, obstacles: readonly Box[], canvas: Size, gap = 8): Box {
  const blocking = obstacles.filter(obstacle => obstacle.width > 0 && obstacle.height > 0)
  if (!blocking.some(obstacle => overlaps(box, obstacle))) return box

  const candidates: Box[] = []
  for (const obstacle of blocking) {
    candidates.push(
      { ...box, y: obstacle.y - box.height - gap },
      { ...box, y: obstacle.y + obstacle.height + gap },
      { ...box, x: obstacle.x - box.width - gap },
      { ...box, x: obstacle.x + obstacle.width + gap },
    )
  }

  let best: Box | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    if (!inside(candidate, canvas)) continue
    if (blocking.some(obstacle => overlaps(candidate, obstacle))) continue
    const distance = Math.abs(candidate.x - box.x) + Math.abs(candidate.y - box.y)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best ?? box
}

export function connectors(modules: readonly RoadmapModule[], boxes: Readonly<Record<string, Box>>): Connector[] {
  const lines: Connector[] = []
  for (let index = 1; index < modules.length; index += 1) {
    const from = modules[index - 1]
    const to = modules[index]
    if (!from || !to) continue
    const start = boxes[from.id]
    const end = boxes[to.id]
    if (!start || !end) continue
    lines.push({
      from: from.id,
      to: to.id,
      kind: to.current ? 'current' : to.state === 'closed' ? 'closed' : 'mastered',
      path: curve(centre(start), centre(end)),
    })
  }
  return lines
}

function curve(start: { x: number, y: number }, end: { x: number, y: number }): string {
  const bend = (end.x - start.x) / 2
  return `M ${round(start.x)} ${round(start.y)} C ${round(start.x + bend)} ${round(start.y)}, ${round(end.x - bend)} ${round(end.y)}, ${round(end.x)} ${round(end.y)}`
}

function centre(box: Box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function overlaps(a: Box, b: Box, gap = 0): boolean {
  return a.x < b.x + b.width + gap
    && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap
    && a.y + a.height + gap > b.y
}

// Cards that dodge the same panel can land on each other. Nudge each one
// to the nearest free spot that stays on the canvas.
export function spread(
  boxes: readonly Box[],
  canvas: Size,
  gap = 12,
  obstacles: readonly Box[] = [],
): Box[] {
  const placed: Box[] = []
  for (const box of boxes) {
    let next = { ...box }
    for (let guard = 0; guard < boxes.length + obstacles.length; guard += 1) {
      const blockers = [
        ...placed.filter(other => overlaps(next, other, gap)),
        ...obstacles.filter(obstacle => overlaps(next, obstacle, gap)),
      ]
      if (blockers.length === 0) break
      const candidates = blockers.flatMap(blocker => [
        { ...next, y: blocker.y + blocker.height + gap },
        { ...next, y: blocker.y - next.height - gap },
        { ...next, x: blocker.x + blocker.width + gap },
        { ...next, x: blocker.x - next.width - gap },
      ])
      const nearest = candidates
        .filter(candidate => inside(candidate, canvas)
          && !placed.some(other => overlaps(candidate, other, gap))
          && !obstacles.some(obstacle => overlaps(candidate, obstacle, gap)))
        .sort((left, right) => {
          const leftDistance = Math.abs(left.x - box.x) + Math.abs(left.y - box.y)
          const rightDistance = Math.abs(right.x - box.x) + Math.abs(right.y - box.y)
          return leftDistance - rightDistance
        })[0]
      if (!nearest) break
      next = nearest
    }
    placed.push(next)
  }
  return placed
}

function inside(box: Box, canvas: Size): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.width <= canvas.width && box.y + box.height <= canvas.height
}

function room(canvasLength: number, cardLength: number): number {
  return Math.max(0, canvasLength - cardLength)
}

function unit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
