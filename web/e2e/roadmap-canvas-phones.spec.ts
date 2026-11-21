import { expect, test, type Locator, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts, resetDemoMindmapPositions } from './reset-demo-accounts'

// The live Mindmap canvas is the seam. Positions, scroll, and what a Student can
// reach are observed in the browser.

const anAccount = demoAccounts.find(account => account.displayName === 'An')
const moduleNames = [
  'Getting Started with Programming and Python',
  'Variables, Data Types, and Operators',
  'Working with Strings',
  'Conditional Statements',
  'Loops',
  'Lists and Tuples',
  'Dictionaries and Sets',
  'Functions',
  'Modules and the Standard Library',
  'File Handling',
  'Error Handling and Debugging',
] as const
const phoneWidths = [320, 390, 430] as const

test.beforeAll(async () => {
  await resetDemoAccounts()
})

test.beforeEach(resetDemoMindmapPositions)
test.afterAll(async () => {
  await resetDemoMindmapPositions()
  await resetDemoAccounts()
})

test('places the canvas above the Mindmap panel on a tablet', async ({ page }) => {
  await openWorkspace(page, { width: 768, height: 1024 })
  await showMindmap(page)

  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Collapse working area', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Expand working area', exact: true })).toHaveCount(0)
  await expect(page.getByText('ACTIVE', { exact: true })).toBeHidden()
  await expectNoDocumentScroll(page)

  const viewport = page.viewportSize()
  const header = await page.locator('main > header').boundingBox()
  const canvas = await canvasBox(page)
  const conversationBox = await page.getByRole('complementary', { name: 'Mindmap panel' }).boundingBox()
  expect(viewport).not.toBeNull()
  expect(header).not.toBeNull()
  expect(canvas).not.toBeNull()
  await expect(page.getByRole('region', { name: 'Working area', exact: true })).toHaveCount(0)
  expect(conversationBox).not.toBeNull()

  const workspaceHeight = viewport!.height - (header!.y + header!.height)
  expect(canvas!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1)
  expect(canvas!.width).toBeGreaterThanOrEqual(viewport!.width - 2)
  expect(canvas!.height / workspaceHeight).toBeGreaterThan(0.4)
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(conversationBox!.y + 1)
  expect(conversationBox!.x + conversationBox!.width).toBeGreaterThanOrEqual(viewport!.width - 2)
  expect(conversationBox!.y + conversationBox!.height).toBeGreaterThanOrEqual(viewport!.height - 2)

  await expectModulesFit(page)
  await expectChromeFits(page)
})

test('shows the full-height canvas on the Mindmap tab of a phone', async ({ page }) => {
  await openWorkspace(page, { width: 375, height: 812 })
  await showMindmap(page)
  await page.getByRole('tab', { name: 'Progress map', exact: true }).click()

  await expect(page.getByRole('tab', { name: 'Progress map', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Working area', exact: true })).toBeHidden()
  await expect(notesPanel(page)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Collapse working area', exact: true })).toHaveCount(0)
  await expect(page.getByText('ACTIVE', { exact: true })).toBeHidden()
  await expectNoDocumentScroll(page)

  const viewport = page.viewportSize()
  const tab = await page.getByRole('tab', { name: 'Progress map', exact: true }).boundingBox()
  const canvas = await canvasBox(page)
  expect(viewport).not.toBeNull()
  expect(tab).not.toBeNull()
  expect(canvas).not.toBeNull()
  expect(canvas!.y).toBeGreaterThanOrEqual(tab!.y + tab!.height - 2)
  expect(canvas!.y).toBeLessThanOrEqual(tab!.y + tab!.height + 2)
  expect(canvas!.width).toBeGreaterThanOrEqual(viewport!.width - 2)
  expect(canvas!.y + canvas!.height).toBeGreaterThanOrEqual(viewport!.height - 2)
  expect(canvas!.height).toBeGreaterThan(viewport!.height * 0.7)

  await expectModulesFit(page)
  await expectChromeFits(page)
})

test('drags a module by touch on a tablet and a phone, and the connector follows', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    hasTouch: true,
    viewport: { width: 768, height: 1024 },
  })
  const page = await context.newPage()
  try {
    await openWorkspace(page, { width: 768, height: 1024 })
    await showMindmap(page)
    await dragModuleByTouch(page, 'Variables, Data Types, and Operators')

    await resetDemoMindmapPositions()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Reset arrangement', exact: true })).toBeEnabled()
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole('tab', { name: 'Progress map', exact: true }).click()
    await expect(moduleCard(page, 'Variables, Data Types, and Operators')).toBeVisible()
    await dragModuleByTouch(page, 'Variables, Data Types, and Operators')
  }
  finally {
    await context.close()
  }
})

test('keeps the modules apart when the screen is turned sideways', async ({ page }) => {
  await openWorkspace(page, { width: 812, height: 375 })
  await showMindmap(page)
  await expectModulesFit(page)
  await expectChromeFits(page)
  await expectNoDocumentScroll(page)

  await page.setViewportSize({ width: 667, height: 375 })
  await page.getByRole('tab', { name: 'Progress map', exact: true }).click()
  await expectModulesFit(page)
  await expectChromeFits(page)
  await expectNoDocumentScroll(page)
})

test('pans, pinch-zooms and opens a bottom sheet on a phone', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, reducedMotion: 'reduce', viewport: { width: 390, height: 800 } })
  const page = await context.newPage()
  try {
    await openWorkspace(page, { width: 390, height: 800 })
    await showMindmap(page)
    await expect(page.getByRole('button', { name: 'Reset arrangement' })).toBeEnabled()
    const canvas = (await page.getByRole('region', { name: 'Mindmap canvas' }).boundingBox())!
    const card = moduleCard(page, moduleNames[0])
    const before = (await card.boundingBox())!
    await touchDrag(page, { x: 195, y: canvas.y + 90 }, { x: 235, y: canvas.y + 92 })
    await expect.poll(async () => (await card.boundingBox())!.x - before.x).toBeGreaterThan(30)

    const client = await context.newCDPSession(page)
    try {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 140, y: canvas.y + 90, id: 1 }, { x: 230, y: canvas.y + 90, id: 2 }],
      })
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 100, y: canvas.y + 90, id: 1 }, { x: 270, y: canvas.y + 90, id: 2 }],
      })
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    finally {
      await client.detach()
    }
    await expect(page.getByRole('button', { name: 'Fit all modules' })).toHaveText('189%')
    await expect(card.getByRole('button')).toHaveAttribute('aria-pressed', 'false')

    await page.getByRole('tab', { name: 'Notes List', exact: true }).click()
    const panel = page.getByRole('complementary', { name: 'Mindmap panel' })
    await expect(panel.getByRole('region', { name: 'Notes List', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Mindmap canvas' })).toBeVisible()
    const sheet = (await panel.boundingBox())!
    expect(sheet.y).toBeGreaterThan(canvas.y)
    expect(sheet.y + sheet.height).toBeCloseTo(canvas.y + canvas.height, 0)
    await expectNoDocumentScroll(page)
  }
  finally {
    await context.close()
  }
})

test('reaches the notes editor on a phone', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 800 })
  await showMindmap(page)

  for (const width of phoneWidths) {
    await page.setViewportSize({ width, height: 800 })
    await expectNoDocumentScroll(page)

    await page.getByRole('tab', { name: 'Progress map', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Progress map', exact: true })).toBeVisible()
    await expectNoDocumentScroll(page)
    await expectModulesFit(page)

    await page.getByRole('tab', { name: 'Notes List', exact: true }).click()
    await page.getByRole('button', { name: 'New note', exact: true }).click()
    await expectReachable(page, page.getByRole('textbox', { name: 'Title' }))
    await expectReachable(page, page.getByRole('button', { name: 'Save', exact: true }))
    await expect(page.getByRole('button', { name: 'Learn', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Practice', exact: true })).toHaveCount(0)
    await expectNoDocumentScroll(page)
  }
})

async function dragModuleByTouch(page: Page, name: string) {
  await expect(page.getByRole('button', { name: 'Reset arrangement' })).toBeEnabled()
  const canvas = await canvasBox(page)
  const card = moduleCard(page, name)
  await expect(card).toBeVisible()
  const before = await card.boundingBox()
  expect(canvas).not.toBeNull()
  expect(before).not.toBeNull()
  const paths = await connectorPaths(page)
  const scrollBefore = await scrollOffset(page)
  const saved = page.waitForResponse(response => response.url().endsWith('/api/student')
    && response.request().postDataJSON()?.event === 'mindmap_moved')
  await touchDrag(page, centerOf(before!), {
    x: canvas!.x + before!.width / 2 + 12,
    y: canvas!.y + before!.height / 2 + 12,
  })
  expect((await saved).ok()).toBe(true)

  await expect.poll(async () => {
    const after = await card.boundingBox()
    if (!after || !canvas) return false
    const moved = Math.hypot(after.x - before!.x, after.y - before!.y) > 16
    const pathsNow = await connectorPaths(page)
    const followed = pathsNow.some((path, index) => path !== paths[index])
    return moved && followed && within(after, canvas)
  }).toBe(true)
  expect(await scrollOffset(page)).toEqual(scrollBefore)
  await expectNoDocumentScroll(page)
}

async function expectModulesFit(page: Page) {
  const canvas = await canvasBox(page)
  const label = await bandBox(page.getByRole('heading', { name: 'Progress map', exact: true }))
  const footer = await bandBox(page.getByRole('button', { name: 'Reset arrangement', exact: true }))
  expect(canvas).not.toBeNull()
  expect(label).not.toBeNull()
  expect(footer).not.toBeNull()

  const boxes = []
  for (const name of moduleNames) {
    const card = moduleCard(page, name)
    await expect(card).toBeVisible()
    const box = await card.boundingBox()
    expect(box, name).not.toBeNull()
    expect(within(box!, canvas!), name).toBe(true)
    expect(overlaps(box!, label!), name).toBe(false)
    expect(overlaps(box!, footer!), name).toBe(false)
    boxes.push(box!)
  }
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      expect(overlaps(boxes[left]!, boxes[right]!), `${moduleNames[left]} overlaps ${moduleNames[right]}`).toBe(false)
    }
  }
}

async function expectChromeFits(page: Page) {
  const canvas = await canvasBox(page)
  const course = await page.getByText('Introduction to Programming with Python', { exact: true }).boundingBox()
  const reset = await page.getByRole('button', { name: 'Reset arrangement', exact: true }).boundingBox()
  const controls = await page.getByRole('toolbar', { name: 'Canvas controls' }).boundingBox()
  const zoomIn = await page.getByRole('button', { name: 'Zoom in', exact: true }).boundingBox()
  expect(canvas).not.toBeNull()
  expect(course).not.toBeNull()
  expect(reset).not.toBeNull()
  expect(controls).not.toBeNull()
  expect(zoomIn).not.toBeNull()
  expect(within(course!, canvas!)).toBe(true)
  expect(within(controls!, canvas!)).toBe(true)
  // Bottom centre, with hit areas of at least 44 px.
  expect(controls!.y).toBeGreaterThan(canvas!.y + canvas!.height * 0.55)
  expect(Math.abs(controls!.x + controls!.width / 2 - (canvas!.x + canvas!.width / 2))).toBeLessThan(4)
  expect(reset!.height).toBeGreaterThanOrEqual(44)
  expect(zoomIn!.width).toBeGreaterThanOrEqual(44)
  await expect(page.getByText('Studio canvas', { exact: true })).toHaveCount(0)
}

function moduleCard(page: Page, name: string): Locator {
  return page.getByRole('list', { name: 'Modules' }).getByRole('listitem').filter({
    has: page.getByText(name, { exact: true }),
  })
}

function notesPanel(page: Page): Locator {
  return page.getByRole('region', { name: 'Notes List', exact: true })
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
  return a.x < b.x + b.width - 1
    && a.x + a.width > b.x + 1
    && a.y < b.y + b.height - 1
    && a.y + a.height > b.y + 1
}

function within(card: Bounds, canvas: Bounds): boolean {
  return card.x >= canvas.x - 1
    && card.y >= canvas.y - 1
    && card.x + card.width <= canvas.x + canvas.width + 1
    && card.y + card.height <= canvas.y + canvas.height + 1
}

async function canvasBox(page: Page): Promise<Bounds | null> {
  return page.getByRole('list', { name: 'Modules' }).boundingBox()
}

async function bandBox(locator: Locator): Promise<Bounds | null> {
  return locator.evaluate((element) => {
    const band = element.parentElement
    if (!band) return null
    const box = band.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  })
}

async function connectorPaths(page: Page): Promise<string[]> {
  return page.getByRole('img', { name: 'Module connectors' }).locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d') ?? ''))
}

async function scrollOffset(page: Page) {
  return page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }))
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

async function expectNoDocumentScroll(page: Page) {
  const measured = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }))
  expect(measured.scrollWidth).toBe(measured.clientWidth)
  expect(measured.scrollHeight).toBe(measured.clientHeight)
}

async function expectReachable(page: Page, locator: Locator) {
  await expect(async () => {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) throw new Error('Element is not on screen.')
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  }).toPass()
}

async function showMindmap(page: Page) {
  const roadmapLink = page.getByRole('navigation', { name: 'Workspace layout' }).getByRole('link', { name: 'Progress map', exact: true })
  if (await roadmapLink.getAttribute('aria-current') !== 'page') await roadmapLink.click()
  await expect(roadmapLink).toHaveAttribute('aria-current', 'page')
  if (await page.getByRole('tab', { name: 'Progress map', exact: true }).count() > 0) return
  await expect(page.getByRole('heading', { name: 'Progress map', exact: true })).toBeVisible()
}

async function openWorkspace(page: Page, size: { width: number, height: number }) {
  if (!anAccount) throw new Error('Demo account An is missing.')
  await page.setViewportSize(size)
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(anAccount.email)
  await page.getByLabel('Password').fill(anAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Working area' }).getByRole('heading', { name: 'Getting Started with Programming and Python' })).toBeVisible({ timeout: 60_000 })
  await waitForApp(page)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}
