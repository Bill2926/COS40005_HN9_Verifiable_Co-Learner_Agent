import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts, resetDemoMindmapPositions } from './reset-demo-accounts'

// The live workspace is the seam. A layout is whichever arrangement of the
// course roadmap, working area and conversation a Student can see.

const anAccount = demoAccounts.find(account => account.displayName === 'An')
const binhAccount = demoAccounts.find(account => account.displayName === 'Bình')

test.beforeAll(async () => {
  await resetDemoAccounts()
})

test.beforeEach(resetDemoMindmapPositions)
test.afterAll(async () => {
  await resetDemoMindmapPositions()
  await resetDemoAccounts()
})

test('marks Study as the current layout on the first visit', async ({ page }) => {
  await openWorkspace(page)

  const switcher = page.getByRole('navigation', { name: 'Workspace layout' })
  const ide = switcher.getByRole('link', { name: 'Study', exact: true })
  const mindmapCanvas = switcher.getByRole('link', { name: 'Mindmap', exact: true })

  await expect(switcher.getByRole('link')).toHaveText(['Study', 'Mindmap'])
  await expect(ide).toHaveAttribute('aria-current', 'page')
  await expect(ide).toHaveAttribute('href', /[?&]layout=study(?:&|$)/)
  await expect(mindmapCanvas).toHaveAttribute('href', /[?&]layout=mindmap(?:&|$)/)
  await expect(mindmapCanvas).not.toHaveAttribute('aria-current', 'page')
  await expectIde(page)

  await page.getByRole('heading', { name: 'Course roadmap', exact: true }).click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')
  await expect(ide).toHaveAttribute('aria-current', 'page')
  await expect(page).not.toHaveURL(/[?&]layout=mindmap(?:&|$)/)
  await expectIde(page)
})

test('switches to Mindmap without reloading, and back and forward restore each layout', async ({ page }) => {
  await openWorkspace(page)
  const switcher = page.getByRole('navigation', { name: 'Workspace layout' })
  let loads = 0
  page.on('load', () => {
    loads += 1
  })

  await switcher.getByRole('link', { name: 'Mindmap', exact: true }).click()
  await expect(page).toHaveURL(/[?&]layout=mindmap(?:&|$)/)
  await expect(switcher.getByRole('link', { name: 'Mindmap', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(switcher.getByRole('link', { name: 'Study', exact: true })).not.toHaveAttribute('aria-current', 'page')
  expect(loads).toBe(0)
  await expectMindmapCanvas(page)
  await expectFloatingPanels(page)

  await page.goBack()
  await expect(switcher.getByRole('link', { name: 'Study', exact: true })).toHaveAttribute('aria-current', 'page')
  await expectIde(page)

  await page.goForward()
  await expect(page).toHaveURL(/[?&]layout=mindmap(?:&|$)/)
  await expectMindmapCanvas(page)
  await expectFloatingPanels(page)
})

test('reloads the remembered layout from the server and falls back when the layout is unknown', async ({ page, browser }) => {
  await openWorkspace(page)
  await forgetLayout(page)

  await page.goto('/?layout=nope')
  await expect(page.getByRole('navigation', { name: 'Workspace layout' }).getByRole('link', { name: 'Study', exact: true })).toHaveAttribute('aria-current', 'page')
  await expectIde(page)
  await page.goto('/')
  await expectIde(page)

  await page.getByRole('link', { name: 'Mindmap', exact: true }).click()
  await expectMindmapCanvas(page)
  await expectServerLayout(browser, await page.context().storageState(), 'mindmap')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Mindmap', exact: true })).toHaveAttribute('aria-current', 'page')
  await expectMindmapCanvas(page)

  await page.goto('/?layout=nope')
  await expect(page.getByRole('link', { name: 'Mindmap', exact: true })).toHaveAttribute('aria-current', 'page')
  await expectMindmapCanvas(page)
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
  await switcher.getByRole('link', { name: 'Mindmap', exact: true }).click()
  await expectMindmapCanvas(page)
  await expect(conversation(page)).toContainText(studentMessage)
  await expect(conversation(page)).toContainText(teacherReply)
  await expect(composer).toHaveValue(unsent)
  await expect(page.getByRole('region', { name: 'Working area' })).toBeHidden()

  await switcher.getByRole('link', { name: 'Study', exact: true }).click()
  await expectIde(page)
  await expect(conversation(page)).toContainText(studentMessage)
  await expect(conversation(page)).toContainText(teacherReply)
  await expect(editor).toContainText('print("hello")')
  await expect(composer).toHaveValue(unsent)
  await expect(printed).toContainText('hello')
  await expect(page.getByRole('button', { name: 'Practice', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('shows the closed module reason and Study link on the Mindmap', async ({ page }) => {
  await openWorkspace(page)
  await expect(page.getByRole('button', { name: 'Collapse working area', exact: true })).toHaveCount(0)

  await page.getByRole('link', { name: 'Mindmap', exact: true }).click()
  await expectMindmapCanvas(page)

  await expect(page.getByText('Introduction to Programming with Python', { exact: true })).toBeVisible()
  const modules = page.getByRole('list', { name: 'Modules' })
  await expect(modules.getByRole('listitem')).toHaveCount(11)
  const current = moduleCard(page, 'Getting Started with Programming and Python')
  const closed = moduleCard(page, 'Lists and Tuples')
  await expect(current).toBeVisible()
  await expect(current).toContainText('Current')
  await expect(current.getByRole('button')).toHaveAccessibleName(/current, open/)
  await expect(closed.getByRole('button')).toHaveAccessibleName(/closed/)
  // A card shows its name only, never the module's description.
  await expect(closed).not.toContainText('Not available yet')
  await expect(modules).not.toContainText('Part 1: Foundations')

  const connectors = page.getByRole('img', { name: 'Module connectors' })
  await expect(connectors.locator('path')).toHaveCount(10)
  const drawn = await connectors.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d') ?? ''))
  expect(drawn.every(path => path.startsWith('M '))).toBe(true)

  await expect(page.getByRole('region', { name: 'Working area', exact: true })).toHaveCount(0)
  await expect(page.getByText('ACTIVE', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Notes', exact: true })).toBeVisible()
  await expect(conversation(page)).toHaveCount(0)
  await closed.getByRole('button').click()
  await expect(page.getByRole('complementary', { name: 'Mindmap panel' })).toContainText('Not available yet')
  await expect(current).toHaveAttribute('aria-current', 'true')
  await current.getByRole('button').click()
  await page.getByRole('link', { name: 'Study this module' }).click()
  await expectIde(page)
})

test('selects an unlocked module from the Mindmap and resumes it after a reload', async ({ page }) => {
  if (!binhAccount) throw new Error('Demo account Bình is missing.')
  await page.goto('/sign-in')
  await waitForApp(page)
  await signInAs(page, binhAccount)
  await showMindmap(page)

  const name = 'Variables, Data Types, and Operators'
  const module = moduleCard(page, name)
  await expect(module.getByRole('button')).toHaveAccessibleName(/mastered|open/)
  const saved = page.waitForResponse(response => response.url().endsWith('/turn')
    && response.request().postDataJSON()?.event === 'select_module')
  await module.getByRole('button').click()
  expect((await saved).ok()).toBe(true)
  await expect(module).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('complementary', { name: 'Mindmap panel' })
    .getByRole('heading', { name, exact: true })).toBeVisible()

  await page.reload()
  await expect(module).toHaveAttribute('aria-current', 'true')
  await page.getByRole('link', { name: 'Study this module' }).click()
  const work = page.getByRole('region', { name: 'Working area', exact: true })
  await expect(work.getByRole('heading', { name, exact: true })).toBeVisible()
})

test('drags a module with the mouse and leaves the current module and working area unchanged', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('link', { name: 'Mindmap', exact: true }).click()
  await expectMindmapCanvas(page)
  await expect(page.getByRole('img', { name: 'Module connectors' }).locator('path')).toHaveCount(10)

  const paths = await connectorPaths(page)
  const before = await dragCard(page, 'Working with Strings', { dx: 160, dy: 24 })
  const after = await moduleCard(page, 'Working with Strings').boundingBox()
  expect(after).not.toBeNull()
  expect(Math.hypot(after!.x - before.x, after!.y - before.y)).toBeGreaterThan(80)

  const moved = await connectorPaths(page)
  expect(moved[1]).not.toBe(paths[1])
  expect(moved[0]).toBe(paths[0])
  await expect(moduleCard(page, 'Getting Started with Programming and Python').getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  await expect(moduleCard(page, 'Getting Started with Programming and Python')).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('region', { name: 'Working area', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Notes', exact: true })).toBeVisible()

  const tick = moduleCard(page, 'Variables, Data Types, and Operators').locator('img')
  const tickBox = await tick.boundingBox()
  const variablesBefore = await moduleCard(page, 'Variables, Data Types, and Operators').boundingBox()
  expect(tickBox).not.toBeNull()
  expect(variablesBefore).not.toBeNull()
  await page.mouse.move(tickBox!.x + tickBox!.width / 2, tickBox!.y + tickBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(tickBox!.x + 160, tickBox!.y, { steps: 12 })
  await page.mouse.up()
  const variablesAfter = await moduleCard(page, 'Variables, Data Types, and Operators').boundingBox()
  expect(variablesAfter).not.toBeNull()
  expect(variablesAfter!.x - variablesBefore!.x).toBeGreaterThan(40)

  const branchingBefore = await moduleCard(page, 'Working with Strings').boundingBox()
  expect(branchingBefore).not.toBeNull()
  await dragCard(page, 'Working with Strings', { dx: 80, dy: 0 })
  const branchingAfter = await moduleCard(page, 'Working with Strings').boundingBox()
  expect(branchingAfter).not.toBeNull()
  expect(branchingAfter!.x - branchingBefore!.x).toBeGreaterThan(40)
})

test('drags a module with touch without scrolling the page', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    hasTouch: true,
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  try {
    await openWorkspace(page)
    await page.getByRole('link', { name: 'Mindmap', exact: true }).click()
    await expectMindmapCanvas(page)

    const card = moduleCard(page, 'Working with Strings')
    await expect(page.getByRole('button', { name: 'Reset arrangement' })).toBeEnabled()
    await card.getByRole('button').click({ trial: true })
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

test('moves a module anywhere on the board, and fit all brings every module back into view', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('link', { name: 'Mindmap', exact: true }).click()
  await expectMindmapCanvas(page)

  const canvas = await page.getByRole('list', { name: 'Modules' }).boundingBox()
  expect(canvas).not.toBeNull()
  for (let step = 0; step < 3; step += 1) await page.getByRole('button', { name: 'Zoom out', exact: true }).click()

  // Zoomed out, the left of the canvas lies past the edge of the starting board.
  // The card follows the pointer there instead of stopping at an invisible wall.
  const farPoint = { x: canvas!.x + 80, y: canvas!.y + 220 }
  await dragCard(page, 'Variables, Data Types, and Operators', farPoint)
  const far = await moduleCard(page, 'Variables, Data Types, and Operators').boundingBox()
  expect(far).not.toBeNull()
  expect(Math.abs(centerOf(far!).x - farPoint.x)).toBeLessThanOrEqual(4)
  expect(Math.abs(centerOf(far!).y - farPoint.y)).toBeLessThanOrEqual(4)

  await dragCard(page, 'Working with Strings', centerOf(far!))
  const dropped = await moduleCard(page, 'Working with Strings').boundingBox()
  const under = await moduleCard(page, 'Variables, Data Types, and Operators').boundingBox()
  expect(dropped).not.toBeNull()
  expect(under).not.toBeNull()
  expect(overlaps(dropped!, under!)).toBe(false)

  await page.reload()
  await expectMindmapCanvas(page)
  await page.getByRole('button', { name: 'Fit all modules', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Working area', exact: true })).toHaveCount(0)
  const conversation = await page.getByRole('complementary', { name: 'Mindmap panel' }).boundingBox()
  expect(conversation).not.toBeNull()
  const cards = page.getByRole('list', { name: 'Modules' }).getByRole('listitem')
  await expect(cards).toHaveCount(11)
  for (const box of await cards.evaluateAll(nodes => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }))) {
    expect(within(box, canvas!)).toBe(true)
    expect(overlaps(box, conversation!)).toBe(false)
  }
})

test('selects a module without moving it, and arrow keys move the focused module', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('link', { name: 'Mindmap', exact: true }).click()
  await expectMindmapCanvas(page)

  const variables = moduleCard(page, 'Variables, Data Types, and Operators')
  const button = variables.getByRole('button')
  await expect(button).toHaveAccessibleName('Variables, Data Types, and Operators, closed. Drag to move.')
  await expect(moduleCard(page, 'Getting Started with Programming and Python').getByRole('button')).toHaveAccessibleName('Getting Started with Programming and Python, current, open, 10% mastery. Drag to move.')
  await expect(moduleCard(page, 'Lists and Tuples').getByRole('button')).toHaveAccessibleName('Lists and Tuples, closed. Drag to move.')
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Reset arrangement' })).toBeEnabled()
  await button.click({ trial: true })

  const before = await variables.boundingBox()
  expect(before).not.toBeNull()
  const start = { x: before!.x + 30, y: before!.y + 24 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 2, start.y + 1)
  await page.mouse.up()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('img', { name: 'Module connectors' }).locator('path')).toHaveCount(10)
  await page.mouse.move(4, 4)
  await expect.poll(async () => {
    const after = (await variables.boundingBox())!
    return Math.hypot(after.x - before!.x, after.y - before!.y)
  }).toBeLessThan(1)

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

  await expect(moduleCard(page, 'Getting Started with Programming and Python')).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('region', { name: 'Working area', exact: true })).toHaveCount(0)
})

test('keeps module positions on the account and resets them across devices', async ({ page, browser }) => {
  if (!anAccount || !binhAccount) throw new Error('Demo accounts An and Bình are missing.')
  await openWorkspace(page)
  await showMindmap(page)

  const start = await moduleOrigins(page)
  // Drop into the free area below the starting module cards.
  await dragCard(page, 'Getting Started with Programming and Python', { x: 410, y: 690 })
  const dragged = await moduleOrigins(page)
  expect(Math.hypot(dragged['Getting Started with Programming and Python'].x - start['Getting Started with Programming and Python'].x, dragged['Getting Started with Programming and Python'].y - start['Getting Started with Programming and Python'].y)).toBeGreaterThan(80)
  for (const name of ['Variables, Data Types, and Operators', 'Working with Strings', 'Lists and Tuples']) {
    expect(Math.hypot(dragged[name].x - start[name].x, dragged[name].y - start[name].y)).toBeLessThanOrEqual(2)
  }

  await page.getByRole('navigation', { name: 'Workspace layout' }).getByRole('link', { name: 'Study', exact: true }).click()
  await expectIde(page)
  await showMindmap(page)
  await expectArrangement(page, dragged)

  await moduleCard(page, 'Variables, Data Types, and Operators').getByRole('button').focus()
  const nudged = studentEvent(page, 'mindmap_moved')
  await page.keyboard.press('ArrowRight')
  expect((await nudged).ok()).toBe(true)
  const moved = await moduleOrigins(page)
  expect(moved['Variables, Data Types, and Operators'].x - start['Variables, Data Types, and Operators'].x).toBeGreaterThan(12)
  expect(Math.hypot(moved['Getting Started with Programming and Python'].x - dragged['Getting Started with Programming and Python'].x, moved['Getting Started with Programming and Python'].y - dragged['Getting Started with Programming and Python'].y)).toBeLessThanOrEqual(2)

  await page.reload()
  await waitForApp(page)
  await expect(page.getByRole('navigation', { name: 'Workspace layout' })).toBeVisible({ timeout: 60_000 })
  await expectArrangement(page, moved)

  const otherDevice = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const otherPage = await otherDevice.newPage()
    await otherPage.goto('/sign-in')
    await waitForApp(otherPage)
    await signInAs(otherPage, anAccount)
    await showMindmap(otherPage)
    await expectArrangement(otherPage, moved)
  }
  finally {
    await otherDevice.close()
  }

  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await signInAs(page, anAccount)
  await showMindmap(page)
  await expectSignedInAs(page, 'An')
  await expectArrangement(page, moved)

  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await signInAs(page, binhAccount)
  await showMindmap(page)
  await expectSignedInAs(page, 'Bình')
  // Bình arranges her own roadmap. Her starting positions are not An's, and
  // they are her own rather than An's defaults, because her evidence has her
  // modules at a different stage and so her cards are a different size.
  await expectModuleAwayFrom(page, 'Getting Started with Programming and Python', moved, 80)

  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await signInAs(page, anAccount)
  await showMindmap(page)
  await expectArrangement(page, moved)
  const reset = studentEvent(page, 'reset_arrangement')
  await page.getByRole('button', { name: 'Reset arrangement', exact: true }).click()
  expect((await reset).ok()).toBe(true)
  await expectArrangement(page, start)

  await page.reload()
  await waitForApp(page)
  await expect(page.getByRole('navigation', { name: 'Workspace layout' })).toBeVisible({ timeout: 60_000 })
  await expectArrangement(page, start)
})

function moduleCard(page: Page, name: string): Locator {
  return page.getByRole('list', { name: 'Modules' }).getByRole('listitem').filter({
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
  return page.getByRole('img', { name: 'Module connectors' }).locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d') ?? ''))
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
  const card = moduleCard(page, name)
  await expect(page.getByRole('button', { name: 'Reset arrangement' })).toBeEnabled()
  await card.getByRole('button').click({ trial: true })
  const before = await card.boundingBox()
  if (!before) throw new Error(`${name} is not on the canvas.`)
  const start = centerOf(before)
  const target = 'dx' in to ? { x: start.x + to.dx, y: start.y + to.dy } : to
  const saved = studentEvent(page, 'mindmap_moved')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 24 })
  await page.mouse.up()
  expect((await saved).ok()).toBe(true)
  return before
}

function studentEvent(page: Page, event: string) {
  return page.waitForResponse(response => response.url().endsWith('/api/student')
    && response.request().postDataJSON()?.event === event)
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

async function expectServerLayout(browser: Browser, storageState: Awaited<ReturnType<BrowserContext['storageState']>>, layout: 'study' | 'mindmap') {
  const server = await browser.newContext({
    javaScriptEnabled: false,
    storageState,
    viewport: { width: 1440, height: 900 },
  })
  const page = await server.newPage()
  try {
    await page.goto('/')
    if (layout === 'study') await expectIde(page)
    else await expectMindmapCanvas(page)
  }
  finally {
    await server.close()
  }
}

async function showMindmap(page: Page) {
  const mindmapLink = page.getByRole('navigation', { name: 'Workspace layout' }).getByRole('link', { name: 'Mindmap', exact: true })
  if (await mindmapLink.getAttribute('aria-current') !== 'page') await mindmapLink.click()
  await expectMindmapCanvas(page)
  await expect(moduleCard(page, 'Getting Started with Programming and Python')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset arrangement' })).toBeEnabled()
}

function expectSignedInAs(page: Page, displayName: string) {
  return expect(page.getByRole('link', { name: displayName, exact: true })).toHaveAttribute('href', '/profile')
}

async function signInAs(page: Page, account: { email: string, password: string }) {
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Workspace layout' })).toBeVisible({ timeout: 60_000 })
  await waitForApp(page)
}

async function moduleOrigins(page: Page) {
  const origins: Record<string, { x: number, y: number }> = {}
  for (const name of ['Variables, Data Types, and Operators', 'Working with Strings', 'Getting Started with Programming and Python', 'Lists and Tuples']) {
    const card = moduleCard(page, name)
    await expect(card).toBeVisible()
    const box = await card.boundingBox()
    if (!box) throw new Error(`${name} is not on the canvas.`)
    origins[name] = { x: box.x, y: box.y }
  }
  return origins
}

async function expectArrangement(page: Page, expected: Record<string, { x: number, y: number }>) {
  await expect.poll(async () => {
    const actual = await moduleOrigins(page)
    return Math.max(...Object.keys(expected).map((name) => {
      const found = actual[name]
      const point = expected[name]
      if (!found || !point) return Number.POSITIVE_INFINITY
      return Math.hypot(found.x - point.x, found.y - point.y)
    }))
  }).toBeLessThanOrEqual(2)
}

async function expectModuleAwayFrom(
  page: Page,
  name: string,
  other: Record<string, { x: number, y: number }>,
  least: number,
) {
  const point = other[name]
  if (!point) throw new Error(`${name} was never measured.`)
  await expect.poll(async () => {
    const actual = (await moduleOrigins(page))[name]
    if (!actual) return 0
    return Math.hypot(actual.x - point.x, actual.y - point.y)
  }).toBeGreaterThan(least)
}

async function openWorkspace(page: Page) {
  if (!anAccount) throw new Error('Demo account An is missing.')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(anAccount.email)
  await page.getByLabel('Password').fill(anAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Workspace layout' })).toBeVisible({ timeout: 60_000 })
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
    const panels = await panelBoxes(page, 'study')
    return panels ? describeLayout(panels) : 'missing'
  }).toBe('study')
}

async function expectMindmapCanvas(page: Page) {
  await expect.poll(async () => {
    const panels = await panelBoxes(page, 'mindmap')
    return panels ? describeLayout(panels) : 'missing'
  }).toBe('mindmap')
}

async function expectFloatingPanels(page: Page) {
  await expect(page.getByRole('region', { name: 'Working area', exact: true })).toHaveCount(0)
  await expect(page.getByText('ACTIVE', { exact: true })).toHaveCount(0)
  const conversation = await page.getByRole('complementary', { name: 'Mindmap panel' }).boundingBox()
  expect(conversation).not.toBeNull()
  expect(conversation!.x + conversation!.width).toBeGreaterThan(1400)
  expect(conversation!.y).toBeLessThan(120)
}

function describeLayout(panels: { map: Box, working: Box | null, conversation: Box }) {
  if (!panels.working) {
    return panels.conversation.x > panels.map.x + 80 ? 'mindmap' : 'unrecognised'
  }
  const columns = panels.working.x > panels.map.x + 80
    && panels.conversation.x > panels.working.x + 80
    && Math.abs(panels.working.y - panels.map.y) < 40
    && Math.abs(panels.conversation.y - panels.map.y) < 40
  if (columns) return 'study'
  return `unrecognised working=(${Math.round(panels.working.x)},${Math.round(panels.working.y)}) conversation=(${Math.round(panels.conversation.x)},${Math.round(panels.conversation.y)}) map=(${Math.round(panels.map.x)},${Math.round(panels.map.y)})`
}

interface Box {
  x: number
  y: number
}

async function panelBoxes(page: Page, layout: 'study' | 'mindmap') {
  const mindmap = layout === 'mindmap'
  const mapHeading = page.getByRole('heading', { name: mindmap ? 'Mindmap' : 'Course roadmap', exact: true })
  const conversationPanel = mindmap
    ? page.getByRole('complementary', { name: 'Mindmap panel' })
    : page.getByRole('region', { name: 'Conversation', exact: true })
  const workingArea = page.getByRole('region', { name: 'Working area', exact: true })
  if (!await mapHeading.isVisible() || !await conversationPanel.isVisible()) return null
  if (!mindmap && !await workingArea.isVisible()) return null
  const [map, conversation, working] = await Promise.all([
    mapHeading.boundingBox({ timeout: 1000 }),
    conversationPanel.boundingBox({ timeout: 1000 }),
    mindmap ? null : workingArea.boundingBox({ timeout: 1000 }),
  ])
  if (!map || !conversation || (!mindmap && !working)) return null
  return { map, working, conversation }
}
