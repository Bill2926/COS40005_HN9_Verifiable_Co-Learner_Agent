import { expect, test, type Page } from '@playwright/test'
import { lecturerAccount } from '../server/auth/demo-accounts'

// The lecturer previews an edited module as a student would see it: the draft's
// words, the teacher-only marks, the draft's own tests on Submit, and nothing
// recorded and no agent asked.

const hintMarker = 'Say what the line prints before you run it.'
const statementMarker = 'Return the greeting for the name you are given.'
const solution = 'def hello(name):\n    return "Hello, " + name\n'

let editedDraft = false

test.afterEach(async ({ page }) => {
  // A failed run must not leave the shared course sitting on a draft.
  if (!editedDraft) return
  editedDraft = false
  await openLecturer(page, { width: 1440, height: 900 })
  const editor = await openPane(page, 'Editor')
  if (await editor.getByText('Editing an unpublished draft.').first().isVisible()) {
    await editor.getByRole('button', { name: 'Discard draft', exact: true }).click()
    await expect(editor.getByRole('status')).toHaveText('Draft discarded.')
  }
})

test('previews an edited module with its teacher-only marks', async ({ page }) => {
  const requested: string[] = []
  page.on('request', request => requested.push(request.url()))

  await openLecturer(page, { width: 1440, height: 900 })
  await editDraft(page)

  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Course preview' })
  await expect(preview).toBeVisible({ timeout: 60_000 })
  await expect(preview.getByText('Unpublished draft.').first()).toBeVisible()
  await expect(preview.getByText(hintMarker).first()).toBeVisible()
  await expect(preview.getByText('correct, teacher only').first()).toBeVisible()
  await expect(preview.getByText('Teacher only').first()).toBeVisible()
  // A reference solution is a teacher's copy, so it stays out of the student's view.
  await expect(preview.getByText('return "Hello, " + name', { exact: true })).toHaveCount(0)

  // The preview never reaches the agents or the student handler.
  expect(requested.filter(url => url.includes('/api/turn'))).toEqual([])
  expect(requested.filter(url => url.includes('/api/student'))).toEqual([])
})

test('submits code in the preview against the draft tests', async ({ page }) => {
  await openLecturer(page, { width: 1440, height: 900 })
  await editDraft(page)

  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Course preview' })
  await expect(preview).toBeVisible({ timeout: 60_000 })
  await expect(preview.getByText(statementMarker).first()).toBeVisible()

  const code = page.getByRole('textbox', { name: 'Python editor' })
  await expect(code).toBeVisible()
  const check = page.getByRole('region', { name: 'Practice check' })

  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(check.getByText('Failed: greeting for An', { exact: true })).toBeVisible({ timeout: 180_000 })
  await expect(check.getByText('Expected:', { exact: false }).first()).toBeVisible()
  await expect(check.getByText('This is not recorded as evidence.').first()).toBeVisible()

  await code.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(solution)
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(check.getByText('Passed: greeting for An', { exact: true })).toBeVisible({ timeout: 180_000 })
  await expect(check.getByText('Failed: greeting for An', { exact: true })).toHaveCount(0)
})

test('previews a module on a phone', async ({ page }) => {
  await openLecturer(page, { width: 390, height: 844 })
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Course preview' })
  await expect(preview).toBeVisible({ timeout: 60_000 })
  // Whether the draft is published or not is test 1's business; here the
  // preview must simply hold together at a phone width.
  await expect(preview.getByText('Nothing here is saved, and no agent takes part.').first()).toBeVisible()
  expect(await sidewaysScroll(page)).toBe(false)

  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Practice check' })).toBeVisible({ timeout: 180_000 })
  expect(await sidewaysScroll(page)).toBe(false)
})

async function editDraft(page: Page) {
  const editor = await openPane(page, 'Editor')
  const hint = page.getByLabel('Hint 1', { exact: true })
  await hint.fill(`${await hint.inputValue()} ${hintMarker}`)
  await page.getByLabel('Statement for Say hello', { exact: true }).fill(statementMarker)
  await editor.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(editor.getByRole('status')).toHaveText('Draft saved.')
  editedDraft = true
}

async function openPane(page: Page, pane: 'Editor' | 'Preview') {
  await page.getByRole('button', { name: pane, exact: true }).click()
  const region = page.getByRole('region', { name: pane === 'Editor' ? 'Course editor' : 'Course preview' })
  await expect(region).toBeVisible({ timeout: 60_000 })
  return region
}

async function openLecturer(page: Page, size: { width: number, height: number }) {
  await page.setViewportSize(size)
  await page.goto('/lecturer')
  // Without a session the signed-in middleware sends the page to /home, so the
  // sign-in form is only needed when the lecturer page was not reached.
  if (!page.url().endsWith('/lecturer')) {
    await page.goto('/sign-in')
    await waitForApp(page)
    await page.getByLabel('Email').fill(lecturerAccount.email)
    await page.getByLabel('Password').fill(lecturerAccount.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'Lecturer', exact: true })).toBeVisible({ timeout: 60_000 })
  await waitForApp(page)
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
