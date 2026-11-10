import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts } from './reset-demo-accounts'

// The live workspace is the seam. A layout is whichever arrangement of the
// knowledge map, working area and conversation a Student can see.

const anAccount = demoAccounts.find(account => account.displayName === 'An')

test.beforeAll(async () => {
  await resetDemoAccounts()
})

test.afterAll(async () => {
  await resetDemoAccounts()
})

test('marks IDE as the current layout on the first visit', async ({ page }) => {
  await openWorkspace(page)

  const switcher = page.getByRole('navigation', { name: 'Workspace layout' })
  const ide = switcher.getByRole('link', { name: 'IDE', exact: true })
  const mapCanvas = switcher.getByRole('link', { name: 'Map canvas', exact: true })

  await expect(switcher.getByRole('link')).toHaveText(['IDE', 'Map canvas'])
  await expect(ide).toHaveAttribute('aria-current', 'page')
  await expect(ide).toHaveAttribute('href', /[?&]layout=ide(?:&|$)/)
  await expect(mapCanvas).toHaveAttribute('href', /[?&]layout=map(?:&|$)/)
  await expect(mapCanvas).not.toHaveAttribute('aria-current', 'page')
  await expectIde(page)

  await page.getByRole('heading', { name: 'Knowledge map', exact: true }).click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')
  await expect(ide).toHaveAttribute('aria-current', 'page')
  await expect(page).not.toHaveURL(/[?&]layout=map(?:&|$)/)
  await expectIde(page)
})

test('switches to Map canvas without reloading, and back and forward restore each layout', async ({ page }) => {
  await openWorkspace(page)
  const switcher = page.getByRole('navigation', { name: 'Workspace layout' })
  let loads = 0
  page.on('load', () => {
    loads += 1
  })

  await switcher.getByRole('link', { name: 'Map canvas', exact: true }).click()
  await expect(page).toHaveURL(/[?&]layout=map(?:&|$)/)
  await expect(switcher.getByRole('link', { name: 'Map canvas', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(switcher.getByRole('link', { name: 'IDE', exact: true })).not.toHaveAttribute('aria-current', 'page')
  expect(loads).toBe(0)
  await expectMapCanvas(page)
  await expectFloatingPanels(page)

  await page.goBack()
  await expect(switcher.getByRole('link', { name: 'IDE', exact: true })).toHaveAttribute('aria-current', 'page')
  await expectIde(page)

  await page.goForward()
  await expect(page).toHaveURL(/[?&]layout=map(?:&|$)/)
  await expectMapCanvas(page)
  await expectFloatingPanels(page)
})

test('reloads the remembered layout from the server and falls back when the layout is unknown', async ({ page, browser }) => {
  await openWorkspace(page)
  await forgetLayout(page)

  await page.goto('/?layout=nope')
  await expect(page.getByRole('navigation', { name: 'Workspace layout' }).getByRole('link', { name: 'IDE', exact: true })).toHaveAttribute('aria-current', 'page')
  await expectIde(page)
  await page.goto('/')
  await expectIde(page)

  await page.getByRole('link', { name: 'Map canvas', exact: true }).click()
  await expectMapCanvas(page)
  await expectServerLayout(browser, await page.context().storageState(), 'map-canvas')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Map canvas', exact: true })).toHaveAttribute('aria-current', 'page')
  await expectMapCanvas(page)

  await page.goto('/?layout=nope')
  await expect(page.getByRole('link', { name: 'Map canvas', exact: true })).toHaveAttribute('aria-current', 'page')
  await expectMapCanvas(page)
})

test('keeps the conversation, the draft, an unsent message, and the run output across a switch', async ({ page }) => {
  test.setTimeout(360_000)
  await openWorkspace(page)
  const studentMessage = 'Where does the total live?'
  const teacherReply = 'A running total has to be created before the loop, so each pass can add to the same number.'
  const draft = 'print("hello")\n'
  const unsent = 'still typing'

  await page.getByRole('textbox', { name: 'Message' }).fill(studentMessage)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(conversation(page)).toContainText(teacherReply, { timeout: 60_000 })

  await page.getByRole('button', { name: 'Practice', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'Python editor' })
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(draft)
  await expect(editor).toContainText('print("hello")')

  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const printed = page.getByRole('heading', { name: 'Printed output' }).locator('xpath=following-sibling::pre')
  await expect(printed).toContainText('hello', { timeout: 180_000 })

  const composer = page.getByRole('textbox', { name: 'Message' })
  await composer.fill(unsent)

  const switcher = page.getByRole('navigation', { name: 'Workspace layout' })
  await switcher.getByRole('link', { name: 'Map canvas', exact: true }).click()
  await expectMapCanvas(page)
  await expect(conversation(page)).toContainText(studentMessage)
  await expect(conversation(page)).toContainText(teacherReply)
  await expect(editor).toContainText('print("hello")')
  await expect(composer).toHaveValue(unsent)
  await expect(printed).toContainText('hello')
  await expect(page.getByRole('button', { name: 'Practice', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await switcher.getByRole('link', { name: 'IDE', exact: true }).click()
  await expectIde(page)
  await expect(conversation(page)).toContainText(studentMessage)
  await expect(conversation(page)).toContainText(teacherReply)
  await expect(editor).toContainText('print("hello")')
  await expect(composer).toHaveValue(unsent)
  await expect(printed).toContainText('hello')
  await expect(page.getByRole('button', { name: 'Practice', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('shows each topic on the Map canvas and collapses the working area to its header', async ({ page }) => {
  await openWorkspace(page)
  await expect(page.getByRole('button', { name: 'Collapse working area', exact: true })).toHaveCount(0)

  await page.getByRole('link', { name: 'Map canvas', exact: true }).click()
  await expectMapCanvas(page)

  await expect(page.getByText('CS 101: Introduction to Python · Semester 1', { exact: true })).toBeVisible()
  const topics = page.getByRole('list', { name: 'Topics' })
  await expect(topics.getByRole('listitem')).toHaveCount(4)
  const variables = topicCard(page, 'Variables')
  const branching = topicCard(page, 'If / else')
  const current = topicCard(page, 'For loops')
  const closed = topicCard(page, 'Nested loops')
  await expect(variables).toBeVisible()
  await expect(variables).toContainText('Mastered')
  await expect(variables).toContainText('Foundation')
  await expect(branching).toContainText('Mastered')
  await expect(branching).toContainText('Branching logic')
  await expect(current).toContainText('Current')
  await expect(current).toContainText('Open')
  await expect(current).toContainText('Topic 3 of 4')
  await expect(closed).toContainText('Closed')
  await expect(closed).toContainText('Needs For loops.')

  const connectors = page.getByRole('img', { name: 'Topic connectors' })
  await expect(connectors.locator('path')).toHaveCount(3)
  const drawn = await connectors.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d') ?? ''))
  expect(drawn.every(path => path.startsWith('M '))).toBe(true)

  const working = page.getByRole('region', { name: 'Working area', exact: true })
  const collapse = page.getByRole('button', { name: 'Collapse working area', exact: true })
  await expect(collapse).toHaveAttribute('aria-expanded', 'true')
  const expanded = await working.boundingBox()
  expect(expanded).not.toBeNull()
  await collapse.click()

  const expand = page.getByRole('button', { name: 'Expand working area', exact: true })
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('heading', { name: 'Accumulating a total' })).toBeHidden()
  const collapsed = await working.boundingBox()
  expect(collapsed).not.toBeNull()
  expect(collapsed!.height).toBeLessThan(expanded!.height / 2)

  await expand.click()
  await expect(page.getByRole('button', { name: 'Collapse working area', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('heading', { name: 'Accumulating a total' })).toBeVisible()
  const restored = await working.boundingBox()
  expect(restored).not.toBeNull()
  expect(Math.abs(restored!.height - expanded!.height)).toBeLessThanOrEqual(2)
})

test('drags a topic with the mouse and leaves the current topic and working area unchanged', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('link', { name: 'Map canvas', exact: true }).click()
  await expectMapCanvas(page)
  await expect(page.getByRole('img', { name: 'Topic connectors' }).locator('path')).toHaveCount(3)

  const paths = await connectorPaths(page)
  const before = await dragCard(page, 'For loops', { dx: 160, dy: 24 })
  const after = await topicCard(page, 'For loops').boundingBox()
  expect(after).not.toBeNull()
  expect(Math.hypot(after!.x - before.x, after!.y - before.y)).toBeGreaterThan(80)

  const moved = await connectorPaths(page)
  expect(moved[1]).not.toBe(paths[1])
  expect(moved[0]).toBe(paths[0])
  await expect(topicCard(page, 'For loops').getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  await expect(topicCard(page, 'For loops')).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('heading', { name: 'For loops', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Accumulating a total' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Learn', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const tick = topicCard(page, 'Variables').locator('img')
  const tickBox = await tick.boundingBox()
  const variablesBefore = await topicCard(page, 'Variables').boundingBox()
  expect(tickBox).not.toBeNull()
  expect(variablesBefore).not.toBeNull()
  await page.mouse.move(tickBox!.x + tickBox!.width / 2, tickBox!.y + tickBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(tickBox!.x + 160, tickBox!.y, { steps: 12 })
  await page.mouse.up()
  const variablesAfter = await topicCard(page, 'Variables').boundingBox()
  expect(variablesAfter).not.toBeNull()
  expect(variablesAfter!.x - variablesBefore!.x).toBeGreaterThan(40)

  const branchingBefore = await topicCard(page, 'If / else').boundingBox()
  expect(branchingBefore).not.toBeNull()
  await dragCard(page, 'If / else', { dx: 80, dy: 0 })
  const branchingAfter = await topicCard(page, 'If / else').boundingBox()
  expect(branchingAfter).not.toBeNull()
  expect(branchingAfter!.x - branchingBefore!.x).toBeGreaterThan(40)
})

test('drags a topic with touch without scrolling the page', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  try {
    await openWorkspace(page)
    await page.getByRole('link', { name: 'Map canvas', exact: true }).click()
    await expectMapCanvas(page)

    const card = topicCard(page, 'If / else')
    await expect(card).toBeVisible()
    const before = await card.boundingBox()
    expect(before).not.toBeNull()
    const scrollBefore = await scrollOffset(page)
    await touchDrag(page, centerOf(before!), { x: before!.x + before!.width / 2 + 140, y: before!.y + before!.height / 2 })

    await expect.poll(async () => {
      const after = await card.boundingBox()
      return after ? after.x - before!.x : 0
    }).toBeGreaterThan(100)
    expect(await scrollOffset(page)).toEqual(scrollBefore)
  }
  finally {
    await context.close()
  }
})

test('keeps a dragged topic inside the canvas and clear of the panels', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('link', { name: 'Map canvas', exact: true }).click()
  await expectMapCanvas(page)

  const canvas = await page.getByRole('list', { name: 'Topics' }).boundingBox()
  expect(canvas).not.toBeNull()
  await dragCard(page, 'Variables', { x: -80, y: -80 })
  const clamped = await topicCard(page, 'Variables').boundingBox()
  expect(clamped).not.toBeNull()
  expect(within(clamped!, canvas!)).toBe(true)

  const heading = await page.getByRole('heading', { name: 'Knowledge map', exact: true }).boundingBox()
  expect(heading).not.toBeNull()
  await dragCard(page, 'Variables', centerOf(heading!))
  const clearOfLabel = await topicCard(page, 'Variables').boundingBox()
  expect(clearOfLabel).not.toBeNull()
  expect(overlaps(clearOfLabel!, heading!)).toBe(false)
  expect(within(clearOfLabel!, canvas!)).toBe(true)

  const working = page.getByRole('region', { name: 'Working area', exact: true })
  const expanded = await working.boundingBox()
  expect(expanded).not.toBeNull()
  await page.getByRole('button', { name: 'Collapse working area', exact: true }).click()
  const collapsed = await working.boundingBox()
  expect(collapsed).not.toBeNull()
  expect(collapsed!.height).toBeLessThan(expanded!.height / 2)

  await dragCard(page, 'If / else', { x: expanded!.x + 140, y: expanded!.y + 36 })
  const parked = await topicCard(page, 'If / else').boundingBox()
  expect(parked).not.toBeNull()
  expect(overlaps(parked!, collapsed!)).toBe(false)

  await page.getByRole('button', { name: 'Expand working area', exact: true }).click()
  await expect.poll(async () => {
    const card = await topicCard(page, 'If / else').boundingBox()
    const panel = await working.boundingBox()
    if (!card || !panel) return false
    return !overlaps(card, panel) && within(card, canvas!)
  }).toBe(true)

  const workingBox = await working.boundingBox()
  expect(workingBox).not.toBeNull()
  await dragCard(page, 'If / else', centerOf(workingBox!))
  const clearOfWorking = await topicCard(page, 'If / else').boundingBox()
  expect(clearOfWorking).not.toBeNull()
  expect(overlaps(clearOfWorking!, workingBox!)).toBe(false)
  expect(within(clearOfWorking!, canvas!)).toBe(true)

  const conversation = await page.getByRole('region', { name: 'Conversation', exact: true }).boundingBox()
  expect(conversation).not.toBeNull()
  await dragCard(page, 'Nested loops', { x: conversation!.x + conversation!.width / 2, y: conversation!.y + 80 })
  const clearOfConversation = await topicCard(page, 'Nested loops').boundingBox()
  expect(clearOfConversation).not.toBeNull()
  expect(overlaps(clearOfConversation!, conversation!)).toBe(false)
  expect(within(clearOfConversation!, canvas!)).toBe(true)

  const pill = await page.getByText('Studio canvas', { exact: true }).boundingBox()
  expect(pill).not.toBeNull()
  await dragCard(page, 'Nested loops', centerOf(pill!))
  const clearOfPill = await topicCard(page, 'Nested loops').boundingBox()
  expect(clearOfPill).not.toBeNull()
  expect(overlaps(clearOfPill!, pill!)).toBe(false)
  expect(within(clearOfPill!, canvas!)).toBe(true)
})

test('selects a topic without moving it, and arrow keys move the focused topic', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('link', { name: 'Map canvas', exact: true }).click()
  await expectMapCanvas(page)

  const variables = topicCard(page, 'Variables')
  const button = variables.getByRole('button')
  await expect(button).toHaveAccessibleName('Variables, mastered. Drag to move.')
  await expect(topicCard(page, 'For loops').getByRole('button')).toHaveAccessibleName('For loops, current, open. Drag to move.')
  await expect(topicCard(page, 'Nested loops').getByRole('button')).toHaveAccessibleName('Nested loops, closed. Drag to move.')
  await expect(button).toHaveAttribute('aria-pressed', 'false')

  const before = await variables.boundingBox()
  expect(before).not.toBeNull()
  const start = { x: before!.x + 30, y: before!.y + 24 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 2, start.y + 1)
  await page.mouse.up()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('img', { name: 'Topic connectors' }).locator('path')).toHaveCount(3)
  const afterClick = await variables.boundingBox()
  expect(afterClick).not.toBeNull()
  expect(Math.hypot(afterClick!.x - before!.x, afterClick!.y - before!.y)).toBeLessThan(1)

  const beforeStrokes = ['#94a3b8', '#6366f1', '#94a3b8']
  const strokes = await connectorStrokes(page)
  expect(strokes[0]).not.toBe(beforeStrokes[0])
  expect(strokes[1]).toBe(beforeStrokes[1])
  expect(strokes[2]).toBe(beforeStrokes[2])

  await button.focus()
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Space')
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  const afterSpace = await variables.boundingBox()
  expect(Math.hypot(afterSpace!.x - before!.x, afterSpace!.y - before!.y)).toBeLessThan(1)
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-pressed', 'false')

  await page.keyboard.press('ArrowRight')
  const nudged = await variables.boundingBox()
  expect(nudged).not.toBeNull()
  expect(nudged!.x - before!.x).toBeGreaterThan(12)
  expect(nudged!.x - before!.x).toBeLessThan(22)

  await page.keyboard.press('Shift+ArrowDown')
  const leapt = await variables.boundingBox()
  expect(leapt).not.toBeNull()
  expect(leapt!.y - nudged!.y).toBeGreaterThan(40)
  expect(leapt!.y - nudged!.y).toBeLessThan(56)

  await expect(topicCard(page, 'For loops')).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('heading', { name: 'For loops', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Accumulating a total' })).toBeVisible()
})

function topicCard(page: Page, name: string): Locator {
  return page.getByRole('list', { name: 'Topics' }).getByRole('listitem').filter({
    has: page.getByText(name, { exact: true }),
  })
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

function centerOf(box: Bounds) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function within(card: Bounds, canvas: Bounds): boolean {
  return card.x >= canvas.x - 1
    && card.y >= canvas.y - 1
    && card.x + card.width <= canvas.x + canvas.width + 1
    && card.y + card.height <= canvas.y + canvas.height + 1
}

async function connectorPaths(page: Page): Promise<string[]> {
  return page.getByRole('img', { name: 'Topic connectors' }).locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d') ?? ''))
}

async function connectorStrokes(page: Page): Promise<string[]> {
  return page.getByRole('img', { name: 'Topic connectors' }).locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('stroke') ?? ''))
}

async function scrollOffset(page: Page) {
  return page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
    top: document.scrollingElement?.scrollTop ?? 0,
    left: document.scrollingElement?.scrollLeft ?? 0,
  }))
}

async function dragCard(page: Page, name: string, to: { x: number, y: number } | { dx: number, dy: number }) {
  const card = topicCard(page, name)
  await expect(card).toBeVisible()
  const before = await card.boundingBox()
  if (!before) throw new Error(`${name} is not on the canvas.`)
  const start = centerOf(before)
  const target = 'dx' in to ? { x: start.x + to.dx, y: start.y + to.dy } : to
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 24 })
  await page.mouse.up()
  return before
}

async function touchDrag(page: Page, from: { x: number, y: number }, to: { x: number, y: number }) {
  const client = await page.context().newCDPSession(page)
  const steps = 8
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from.x, y: from.y, id: 1 }],
    })
    for (let step = 1; step <= steps; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{
          id: 1,
          x: from.x + ((to.x - from.x) * step) / steps,
          y: from.y + ((to.y - from.y) * step) / steps,
        }],
      })
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  }
  finally {
    await client.detach()
  }
}

function conversation(page: Page): Locator {
  return page.getByRole('region', { name: 'Conversation' })
}

async function forgetLayout(page: Page) {
  const cookies = await page.context().cookies()
  await page.context().clearCookies()
  const keep = cookies.filter(cookie => cookie.name !== 'workspace-layout')
  if (keep.length > 0) await page.context().addCookies(keep)
}

async function expectServerLayout(browser: Browser, storageState: Awaited<ReturnType<BrowserContext['storageState']>>, layout: 'ide' | 'map-canvas') {
  const server = await browser.newContext({
    javaScriptEnabled: false,
    storageState,
    viewport: { width: 1440, height: 900 },
  })
  const page = await server.newPage()
  try {
    await page.goto('/')
    if (layout === 'ide') await expectIde(page)
    else await expectMapCanvas(page)
  }
  finally {
    await server.close()
  }
}

async function openWorkspace(page: Page) {
  if (!anAccount) throw new Error('Demo account An is missing.')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(anAccount.email)
  await page.getByLabel('Password').fill(anAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'For loops' })).toBeVisible({ timeout: 60_000 })
  await waitForApp(page)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}

async function expectIde(page: Page) {
  await expect.poll(async () => {
    const panels = await panelBoxes(page)
    return panels ? describeLayout(panels) : 'missing'
  }).toBe('ide')
}

async function expectMapCanvas(page: Page) {
  await expect.poll(async () => {
    const panels = await panelBoxes(page)
    return panels ? describeLayout(panels) : 'missing'
  }).toBe('map-canvas')
}

async function expectFloatingPanels(page: Page) {
  const working = await page.getByRole('region', { name: 'Working area', exact: true }).boundingBox()
  const conversation = await page.getByRole('region', { name: 'Conversation', exact: true }).boundingBox()
  expect(working).not.toBeNull()
  expect(conversation).not.toBeNull()
  expect(Math.abs(working!.width - 520)).toBeLessThanOrEqual(2)
  expect(Math.abs(working!.height - 448)).toBeLessThanOrEqual(2)
  expect(Math.abs(conversation!.width - 360)).toBeLessThanOrEqual(2)
  expect(conversation!.height).toBeLessThanOrEqual(642)
  expect(conversation!.height).toBeGreaterThan(400)
  expect(working!.x).toBeLessThan(40)
  expect(working!.y + working!.height).toBeGreaterThan(860)
  expect(conversation!.x + conversation!.width).toBeGreaterThan(1400)
  expect(conversation!.y).toBeLessThan(120)
}

function describeLayout(panels: { map: Box, working: Box, conversation: Box }) {
  const columns = panels.working.x > panels.map.x + 80
    && panels.conversation.x > panels.working.x + 80
    && Math.abs(panels.working.y - panels.map.y) < 40
    && Math.abs(panels.conversation.y - panels.map.y) < 40
  if (columns) return 'ide'
  const canvas = panels.conversation.x > panels.working.x + 80
    && panels.working.y > panels.conversation.y + 40
  if (canvas) return 'map-canvas'
  return `unrecognised working=(${Math.round(panels.working.x)},${Math.round(panels.working.y)}) conversation=(${Math.round(panels.conversation.x)},${Math.round(panels.conversation.y)}) map=(${Math.round(panels.map.x)},${Math.round(panels.map.y)})`
}

interface Box {
  x: number
  y: number
}

async function panelBoxes(page: Page) {
  const map = await page.getByRole('heading', { name: 'Knowledge map', exact: true }).boundingBox()
  const working = await page.getByRole('region', { name: 'Working area', exact: true }).boundingBox()
  const conversation = await page.getByRole('region', { name: 'Conversation', exact: true }).boundingBox()
  if (!map || !working || !conversation) return null
  return { map, working, conversation }
}
