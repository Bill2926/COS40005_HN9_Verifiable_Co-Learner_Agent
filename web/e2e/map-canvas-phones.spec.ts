import { expect, test, type Locator, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts } from './reset-demo-accounts'

// The live Map canvas is the seam. Positions, scroll, and what a Student can
// reach are observed in the browser.

const anAccount = demoAccounts.find(account => account.displayName === 'An')
const topicNames = ['Variables', 'If / else', 'For loops', 'Nested loops'] as const
const phoneWidths = [320, 390, 430] as const

test.beforeAll(async () => {
  await resetDemoAccounts()
})

test.afterAll(async () => {
  await resetDemoAccounts()
})

test('places the canvas above two columns on a tablet', async ({ page }) => {
  await openWorkspace(page, { width: 768, height: 1024 })
  await showMap(page)

  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Collapse working area', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Expand working area', exact: true })).toHaveCount(0)
  await expect(page.getByText('ACTIVE', { exact: true })).toBeHidden()
  await expectNoDocumentScroll(page)

  const viewport = page.viewportSize()
  const header = await page.locator('main > header').boundingBox()
  const canvas = await canvasBox(page)
  const working = await page.getByRole('region', { name: 'Working area', exact: true }).boundingBox()
  const conversationBox = await conversation(page).boundingBox()
  expect(viewport).not.toBeNull()
  expect(header).not.toBeNull()
  expect(canvas).not.toBeNull()
  expect(working).not.toBeNull()
  expect(conversationBox).not.toBeNull()

  const workspaceHeight = viewport!.height - (header!.y + header!.height)
  expect(canvas!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1)
  expect(canvas!.width).toBeGreaterThanOrEqual(viewport!.width - 2)
  expect(canvas!.height / workspaceHeight).toBeGreaterThan(0.4)
  expect(canvas!.height / workspaceHeight).toBeLessThan(0.5)
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(working!.y + 1)
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(conversationBox!.y + 1)
  expect(Math.abs(working!.y - conversationBox!.y)).toBeLessThanOrEqual(2)
  expect(working!.x).toBeLessThanOrEqual(1)
  expect(conversationBox!.x).toBeGreaterThanOrEqual(working!.x + working!.width - 2)
  expect(conversationBox!.x + conversationBox!.width).toBeGreaterThanOrEqual(viewport!.width - 2)
  expect(working!.y + working!.height).toBeGreaterThanOrEqual(viewport!.height - 2)
  expect(conversationBox!.y + conversationBox!.height).toBeGreaterThanOrEqual(viewport!.height - 2)
  expect(Math.abs(working!.width - 520)).toBeGreaterThan(40)

  await expectTopicsFit(page)
  await expectChromeFits(page)
})

test('shows the full-height canvas on the Map tab of a phone', async ({ page }) => {
  await openWorkspace(page, { width: 375, height: 812 })
  await showMap(page)
  await page.getByRole('tab', { name: 'Map', exact: true }).click()

  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Working area', exact: true })).toBeHidden()
  await expect(conversation(page)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Collapse working area', exact: true })).toHaveCount(0)
  await expect(page.getByText('ACTIVE', { exact: true })).toBeHidden()
  await expectNoDocumentScroll(page)

  const viewport = page.viewportSize()
  const tab = await page.getByRole('tab', { name: 'Map', exact: true }).boundingBox()
  const canvas = await canvasBox(page)
  expect(viewport).not.toBeNull()
  expect(tab).not.toBeNull()
  expect(canvas).not.toBeNull()
  expect(canvas!.y).toBeGreaterThanOrEqual(tab!.y + tab!.height - 2)
  expect(canvas!.y).toBeLessThanOrEqual(tab!.y + tab!.height + 2)
  expect(canvas!.width).toBeGreaterThanOrEqual(viewport!.width - 2)
  expect(canvas!.y + canvas!.height).toBeGreaterThanOrEqual(viewport!.height - 2)
  expect(canvas!.height).toBeGreaterThan(viewport!.height * 0.7)

  await expectTopicsFit(page)
  await expectChromeFits(page)
})

test('drags a topic by touch on a tablet and a phone, and the connector follows', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 768, height: 1024 },
  })
  const page = await context.newPage()
  try {
    await openWorkspace(page, { width: 768, height: 1024 })
    await showMap(page)
    await dragTopicByTouch(page, 'Variables')

    await page.getByRole('button', { name: 'Reset arrangement', exact: true }).click()
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole('tab', { name: 'Map', exact: true }).click()
    await expect(topicCard(page, 'Variables')).toBeVisible()
    await dragTopicByTouch(page, 'Variables')
  }
  finally {
    await context.close()
  }
})

test('keeps the topics apart when the screen is turned sideways', async ({ page }) => {
  await openWorkspace(page, { width: 812, height: 375 })
  await showMap(page)
  await expectTopicsFit(page)
  await expectChromeFits(page)
  await expectNoDocumentScroll(page)

  await page.setViewportSize({ width: 667, height: 375 })
  await page.getByRole('tab', { name: 'Map', exact: true }).click()
  await expectTopicsFit(page)
  await expectChromeFits(page)
  await expectNoDocumentScroll(page)
})

test('reaches the composer, Send, the editor, Run and Submit on a phone', async ({ page }) => {
  await openWorkspace(page, { width: 390, height: 800 })
  await showMap(page)

  for (const width of phoneWidths) {
    await page.setViewportSize({ width, height: 800 })
    await expectNoDocumentScroll(page)

    await page.getByRole('tab', { name: 'Map', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Knowledge map', exact: true })).toBeVisible()
    await expectNoDocumentScroll(page)
    await expectTopicsFit(page)

    await page.getByRole('tab', { name: 'Conversation', exact: true }).click()
    const composer = page.getByRole('textbox', { name: 'Message' })
    const send = page.getByRole('button', { name: 'Send', exact: true })
    await expectReachable(page, composer)
    await expectReachable(page, send)
    await expectNoDocumentScroll(page)

    await page.getByRole('tab', { name: 'Working area', exact: true }).click()
    await page.getByRole('button', { name: 'Practice', exact: true }).click()
    await expectReachable(page, page.getByRole('textbox', { name: 'Python editor' }))
    await expectReachable(page, page.getByRole('button', { name: 'Run', exact: true }))
    await expectReachable(page, page.getByRole('button', { name: 'Submit', exact: true }))
    await expectNoDocumentScroll(page)
    await page.getByRole('button', { name: 'Learn', exact: true }).click()
  }
})

async function dragTopicByTouch(page: Page, name: string) {
  const canvas = await canvasBox(page)
  const card = topicCard(page, name)
  await expect(card).toBeVisible()
  const before = await card.boundingBox()
  expect(canvas).not.toBeNull()
  expect(before).not.toBeNull()
  const paths = await connectorPaths(page)
  const scrollBefore = await scrollOffset(page)
  await touchDrag(page, centerOf(before!), { x: canvas!.x + 8, y: canvas!.y + 8 })

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

async function expectTopicsFit(page: Page) {
  const canvas = await canvasBox(page)
  const label = await bandBox(page.getByRole('heading', { name: 'Knowledge map', exact: true }))
  const footer = await bandBox(page.getByRole('button', { name: 'Reset arrangement', exact: true }))
  expect(canvas).not.toBeNull()
  expect(label).not.toBeNull()
  expect(footer).not.toBeNull()

  const boxes = []
  for (const name of topicNames) {
    const card = topicCard(page, name)
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
      expect(overlaps(boxes[left]!, boxes[right]!), `${topicNames[left]} overlaps ${topicNames[right]}`).toBe(false)
    }
  }
}

async function expectChromeFits(page: Page) {
  const canvas = await canvasBox(page)
  const course = await page.getByText('CS 101: Introduction to Python · Semester 1', { exact: true }).boundingBox()
  const reset = await page.getByRole('button', { name: 'Reset arrangement', exact: true }).boundingBox()
  const pill = await page.getByText('Studio canvas', { exact: true }).boundingBox()
  expect(canvas).not.toBeNull()
  expect(course).not.toBeNull()
  expect(reset).not.toBeNull()
  expect(pill).not.toBeNull()
  expect(within(course!, canvas!)).toBe(true)
  expect(within(reset!, canvas!)).toBe(true)
  expect(within(pill!, canvas!)).toBe(true)
  expect(reset!.y).toBeGreaterThan(canvas!.y + canvas!.height * 0.55)
  expect(pill!.y).toBeGreaterThan(canvas!.y + canvas!.height * 0.55)
}

function topicCard(page: Page, name: string): Locator {
  return page.getByRole('list', { name: 'Topics' }).getByRole('listitem').filter({
    has: page.getByText(name, { exact: true }),
  })
}

function conversation(page: Page): Locator {
  return page.getByRole('region', { name: 'Conversation', exact: true })
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
  return page.getByRole('list', { name: 'Topics' }).boundingBox()
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
  return page.getByRole('img', { name: 'Topic connectors' }).locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d') ?? ''))
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

async function showMap(page: Page) {
  const mapLink = page.getByRole('navigation', { name: 'Workspace layout' }).getByRole('link', { name: 'Map canvas', exact: true })
  if (await mapLink.getAttribute('aria-current') !== 'page') await mapLink.click()
  await expect(mapLink).toHaveAttribute('aria-current', 'page')
  if (await page.getByRole('tab', { name: 'Map', exact: true }).count() > 0) return
  await expect(page.getByRole('heading', { name: 'Knowledge map', exact: true })).toBeVisible()
}

async function openWorkspace(page: Page, size: { width: number, height: number }) {
  if (!anAccount) throw new Error('Demo account An is missing.')
  await page.setViewportSize(size)
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
