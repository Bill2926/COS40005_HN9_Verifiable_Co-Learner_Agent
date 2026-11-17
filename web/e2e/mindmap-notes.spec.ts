import { expect, test, type Locator, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts, resetDemoMindmapNotes } from './reset-demo-accounts'

// A student adds a note to the mindmap, gives it a colour,
// links it to another note and deletes it, on a desktop and on a phone. Notes
// belong to the account, so a reload shows what was saved.

const anAccount = demoAccounts[0]
const firstModule = 'Getting Started with Programming and Python'

test.beforeAll(async () => {
  await resetDemoAccounts()
  await resetDemoMindmapNotes()
})

test.afterAll(async () => {
  await resetDemoMindmapNotes()
})

test('adds, recolours, links and deletes a note', async ({ page }) => {
  await openNotes(page, { width: 1440, height: 900 })
  const notes = notesPanel(page)
  await expect(notes.getByRole('button', { name: 'New note', exact: true })).toBeVisible({ timeout: 60_000 })

  await addNote(page, 'Loop note', 'A loop keeps a running total.', 'Rose', firstModule)
  await expect(mapCard(page, 'Loop note')).toHaveCount(1)

  await page.reload()
  await openMindmap(page)
  await openNote(page, 'Loop note')
  await expect(swatch(page, 'Rose')).toHaveAttribute('aria-pressed', 'true')
  const colourBefore = await borderColour(page, row(page, 'Loop note'))

  await swatch(page, 'Amber').click()
  await notes.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(notes.getByText('Note saved.', { exact: true })).toBeVisible()
  await page.reload()
  await openMindmap(page)
  await openNote(page, 'Loop note')
  await expect(swatch(page, 'Amber')).toHaveAttribute('aria-pressed', 'true')
  expect(await borderColour(page, row(page, 'Loop note'))).not.toBe(colourBefore)

  await addNote(page, 'Sketch note', 'Indexing starts at zero.', 'Sky', firstModule)
  await openNote(page, 'Loop note')
  await notes.getByLabel('Link to another note').selectOption({ label: 'Sketch note' })
  await notes.getByRole('button', { name: 'Link', exact: true }).click()
  const linkLines = page.locator('svg[aria-label="Note links"] path')
  await expect(linkLines).toHaveCount(3)
  const removeLink = linkedList(page).getByRole('button', { name: 'Remove link' })
  await expect(linkedList(page).getByRole('listitem').filter({ hasText: 'Sketch note' })).toBeVisible()

  await expect(notes.locator('input[type="file"]')).toHaveCount(0)
  await notes.getByRole('button', { name: 'Save', exact: true }).click()

  await removeLink.click()
  await expect(linkLines).toHaveCount(2)

  await page.reload()
  await openMindmap(page)
  await openNote(page, 'Loop note')
  await expect(swatch(page, 'Amber')).toHaveAttribute('aria-pressed', 'true')
  expect(await sidewaysScroll(page)).toBe(false)

  await deleteNote(page, 'Loop note')
  await deleteNote(page, 'Sketch note')
  await expect(notes.getByRole('list', { name: 'Your notes' })).toHaveCount(0)
})

test.describe('on a phone', () => {
  test.use({ hasTouch: true })

  test('adds, recolours, links and deletes a note from the note editor', async ({ page }) => {
    await openNotes(page, { width: 390, height: 844 })
    await showNotesOnPhone(page)
    const notes = notesPanel(page)

    await addNote(page, 'Phone note', 'Drag the card to move it.', 'Green', firstModule)
    expect(await sidewaysScroll(page)).toBe(false)

    await addNote(page, 'Second note', 'Notes stay private.', 'Ink', firstModule)
    await openNote(page, 'Phone note')
    await notes.getByLabel('Link to another note').selectOption({ label: 'Second note' })
    await notes.getByRole('button', { name: 'Link', exact: true }).tap()
    await expect(linkedList(page).getByRole('listitem').filter({ hasText: 'Second note' })).toBeVisible()
    expect(await sidewaysScroll(page)).toBe(false)

    await swatch(page, 'Purple').click()
    await notes.getByRole('button', { name: 'Save', exact: true }).tap()

    await page.reload()
    await openMindmap(page)
    await showNotesOnPhone(page)
    await openNote(page, 'Phone note')
    await expect(swatch(page, 'Purple')).toHaveAttribute('aria-pressed', 'true')

    await deleteNote(page, 'Phone note')
    await deleteNote(page, 'Second note')
    await expect(notes.getByRole('list', { name: 'Your notes' })).toHaveCount(0)
  })
})

function notesPanel(page: Page): Locator {
  return page.getByRole('region', { name: 'Notes', exact: true })
}

function row(page: Page, title: string): Locator {
  return notesPanel(page).getByRole('list', { name: 'Your notes' }).getByRole('button', { name: title, exact: true })
}

function mapCard(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^${title}, linked to `) })
}

function swatch(page: Page, label: string): Locator {
  return notesPanel(page).getByRole('button', { name: label, exact: true })
}

function linkedList(page: Page): Locator {
  return notesPanel(page).getByRole('list', { name: 'Linked notes' })
}

async function borderColour(page: Page, locator: Locator): Promise<string> {
  return locator.evaluate(element => getComputedStyle(element).borderLeftColor)
}

async function openMindmap(page: Page) {
  await page.goto('/?layout=mindmap')
  await waitForApp(page)
}

async function showNotesOnPhone(page: Page) {
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  await expect(notesPanel(page)).toBeVisible({ timeout: 60_000 })
}

async function addNote(
  page: Page,
  title: string,
  body: string,
  colour: string,
  module: string,
) {
  const notes = notesPanel(page)
  await notes.getByRole('button', { name: 'New note', exact: true }).click()
  await notes.getByLabel('Title', { exact: true }).fill(title)
  await notes.getByLabel('Note', { exact: true }).fill(body)
  await swatch(page, colour).click()
  // The label wraps the select, so its accessible name carries the options too.
  await notes.getByLabel('Module').selectOption({ label: module })
  await notes.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(row(page, title)).toBeVisible({ timeout: 20_000 })
  // The save links the module after the row appears, which selects this note
  // again, so the next action waits for the panel to leave the saving state.
  await expect(notes.getByRole('button', { name: 'New note', exact: true })).toBeEnabled()
}

// The editor keeps focus in a field, which pulls the panel back down when a
// row is clicked, so a note is opened with the keyboard.
async function openNote(page: Page, title: string) {
  await row(page, title).press('Enter')
  await expect(notesPanel(page).getByLabel('Title')).toHaveValue(title)
}

async function deleteNote(page: Page, title: string) {
  const notes = notesPanel(page)
  await openNote(page, title)
  await notes.getByRole('button', { name: 'Delete note', exact: true }).click()
  await expect(row(page, title)).toHaveCount(0)
}

async function sidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}

async function openNotes(page: Page, size: { width: number, height: number }) {
  await page.setViewportSize(size)
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(anAccount.email)
  await page.getByLabel('Password').fill(anAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: firstModule })).toBeVisible({ timeout: 60_000 })
  await waitForApp(page)
  await openMindmap(page)
  // On a phone the notes panel is in the sheet behind the Notes tab, so
  // it is not in the accessibility tree yet. The canvas is the shared proof that
  // the Mindmap layout is open.
  await expect(page.getByRole('button', { name: 'Reset arrangement', exact: true })).toBeVisible({ timeout: 60_000 })
}
