import { expect, test, type Page } from '@playwright/test'

// The prototype page is the seam: a reviewer can see and operate the two layouts.
// Expected positions come from the two layouts as drawn, not from component internals.

test('offers only IDE and Map canvas', async ({ page }) => {
  await openPrototype(page, '/prototype/workspace')

  const switcher = page.getByRole('navigation', { name: 'Workspace layout' })
  await expect(switcher).toBeVisible()
  await expect(switcher.getByRole('link')).toHaveText(['IDE', 'Map canvas'])

  const ide = switcher.getByRole('link', { name: 'IDE', exact: true })
  const mapCanvas = switcher.getByRole('link', { name: 'Map canvas', exact: true })
  await expect(ide).toHaveAttribute('aria-current', 'page')
  await expect(ide).toHaveAttribute('href', /[?&]variant=A(?:&|$)/)
  await expect(mapCanvas).toHaveAttribute('href', /[?&]variant=C(?:&|$)/)
  await expect(mapCanvas).not.toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Chat-first')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hide working area' })).toHaveCount(0)
  await expectIde(page)

  await openPrototype(page, '/prototype/workspace?variant=B')
  await expect(page).toHaveURL(/variant=B/)
  await expect(page.getByText('Chat-first')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hide working area' })).toHaveCount(0)
  await expect(ide).toHaveAttribute('aria-current', 'page')
  await expect(mapCanvas).not.toHaveAttribute('aria-current', 'page')
  await expectIde(page)
})

test('opens IDE when the layout in the URL is missing or unknown', async ({ page }) => {
  for (const url of [
    '/prototype/workspace',
    '/prototype/workspace?variant=',
    '/prototype/workspace?variant=nope',
    '/prototype/workspace?variant=b',
  ]) {
    await openPrototype(page, url)
    await expect(page.getByRole('link', { name: 'IDE', exact: true })).toHaveAttribute('aria-current', 'page')
    await expectIde(page)
  }
})

test('moves between the two layouts and restores them with back and forward', async ({ page }) => {
  await openPrototype(page, '/prototype/workspace?variant=A')
  const switcher = page.getByRole('navigation', { name: 'Workspace layout' })

  await switcher.getByRole('link', { name: 'Map canvas', exact: true }).click()
  await expect(page).toHaveURL(/[?&]variant=C(?:&|$)/)
  await expect(switcher.getByRole('link', { name: 'Map canvas', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(switcher.getByRole('link', { name: 'IDE', exact: true })).not.toHaveAttribute('aria-current', 'page')
  await expectMapCanvas(page)

  await switcher.getByRole('link', { name: 'IDE', exact: true }).click()
  await expect(page).toHaveURL(/[?&]variant=A(?:&|$)/)
  await expectIde(page)

  await page.goBack()
  await expect(page).toHaveURL(/[?&]variant=C(?:&|$)/)
  await expectMapCanvas(page)
  await expect(switcher.getByRole('link', { name: 'Map canvas', exact: true })).toHaveAttribute('aria-current', 'page')

  await page.goForward()
  await expect(page).toHaveURL(/[?&]variant=A(?:&|$)/)
  await expectIde(page)
})

test('arrow keys switch layouts unless the composer or the draft is focused', async ({ page }) => {
  await openPrototype(page, '/prototype/workspace?variant=A')
  await page.getByRole('heading', { name: 'Knowledge map', exact: true }).click()

  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/[?&]variant=C(?:&|$)/)
  await expectMapCanvas(page)

  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/[?&]variant=A(?:&|$)/)
  await expectIde(page)

  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/[?&]variant=C(?:&|$)/)
  await expectMapCanvas(page)

  const composer = page.getByRole('textbox', { name: 'Message the Teacher and Mai' })
  await composer.click()
  await composer.fill('still typing')
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/[?&]variant=C(?:&|$)/)
  await expect(composer).toBeFocused()
  await expectMapCanvas(page)

  const draft = page.getByRole('textbox', { name: 'Draft' })
  await draft.click()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/[?&]variant=C(?:&|$)/)
  await expect(draft).toBeFocused()
  await expectMapCanvas(page)
})

test('keeps the draft, conversation, composer, and Shield trace across a switch', async ({ page }) => {
  await openPrototype(page, '/prototype/workspace?variant=A')
  const sent = 'The total has to live outside the loop.'
  const draftText = 'def total(ds):\n    s = 0\n    return s\n'
  const unsent = 'still typing'
  const composer = page.getByRole('textbox', { name: 'Message the Teacher and Mai' })
  const draft = page.getByRole('textbox', { name: 'Draft' })
  const trace = page.getByRole('heading', { name: 'Shield: not active yet' })

  await composer.fill(sent)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText(sent, { exact: true })).toBeVisible()
  await expect(composer).toHaveValue('')

  await draft.fill(draftText)
  await page.getByRole('switch', { name: 'Shield trace' }).click()
  await expect(trace).toBeVisible()
  await composer.fill(unsent)

  const switcher = page.getByRole('navigation', { name: 'Workspace layout' })
  await switcher.getByRole('link', { name: 'Map canvas', exact: true }).click()
  await expectMapCanvas(page)
  await expect(page.getByText(sent, { exact: true })).toBeVisible()
  await expect(draft).toHaveValue(draftText)
  await expect(composer).toHaveValue(unsent)
  await expect(trace).toBeVisible()

  await switcher.getByRole('link', { name: 'IDE', exact: true }).click()
  await expectIde(page)
  await expect(page.getByText(sent, { exact: true })).toBeVisible()
  await expect(draft).toHaveValue(draftText)
  await expect(composer).toHaveValue(unsent)
  await expect(trace).toBeVisible()
})

async function openPrototype(page: Page, path: string) {
  await page.goto(path)
  // Send is a plain form submit until the page is interactive.
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

function describeLayout(panels: { map: Box, working: Box, conversation: Box }) {
  const columns = panels.working.x > panels.map.x + 80
    && panels.conversation.x > panels.working.x + 80
    && Math.abs(panels.working.y - panels.map.y) < 30
    && Math.abs(panels.conversation.y - panels.map.y) < 30
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
  const working = await page.getByRole('heading', { name: 'Working area', exact: true }).boundingBox()
  const conversation = await page.getByRole('heading', { name: 'Conversation', exact: true }).boundingBox()
  if (!map || !working || !conversation) return null
  return { map, working, conversation }
}
