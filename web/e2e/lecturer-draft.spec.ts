import { expect, test, type Page } from '@playwright/test'
import { lecturerAccount } from '../server/auth/demo-accounts'

// The lecturer editor is the seam: an edit stays in the course draft until
// Publish, and Publish changes what is exported as the published spec.
// Each test puts the published spec back afterwards.

const widths = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
] as const

const publishedUrl = '/api/lecturer/spec?courseId=intro_python'

for (const width of widths) {
  test(`edits a hint, adds a diagram block and publishes at ${width.name} width`, async ({ page }) => {
    await page.setViewportSize(width.viewport)
    await signIn(page, lecturerAccount)
    const original = await (await page.request.get(publishedUrl)).text()
    const hint = `Read the first line again (${width.name} ${Date.now()}).`

    try {
      const editor = page.getByRole('region', { name: 'Course editor' })
      await openEditor(page)

      await editor.getByLabel('Hint 1').fill(hint)
      const diagrams = editor.getByRole('textbox', { name: 'Diagram', exact: true })
      const before = await diagrams.count()
      await editor.getByRole('button', { name: 'Add diagram' }).click()
      await expect(diagrams).toHaveCount(before + 1)
      await expect(editor.locator('svg').last()).toBeVisible()

      await editor.getByRole('button', { name: 'Save draft' }).click()
      await expect(editor.getByRole('status')).toHaveText('Draft saved.')
      // Saved but not published: students still get the old hint.
      expect(await (await page.request.get(publishedUrl)).text()).not.toContain(hint)

      await page.reload()
      await waitForApp(page)
      await openEditor(page)
      await expect(editor.getByLabel('Hint 1')).toHaveValue(hint)

      await editor.getByRole('button', { name: 'Publish' }).click()
      await expect(editor.getByRole('status')).toContainText('Published.')
      expect(await (await page.request.get(publishedUrl)).text()).toContain(hint)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    finally {
      const restored = await page.request.post('/api/lecturer/spec', { data: original, headers: { 'Content-Type': 'application/json' } })
      expect(restored.ok()).toBe(true)
      const published = await page.request.post('/api/lecturer/spec', { data: { event: 'publish' } })
      expect(published.ok()).toBe(true)
    }
  })
}

async function signIn(page: Page, account: { email: string, password: string }) {
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/lecturer$/)
  await waitForApp(page)
}

// A click that lands before the page hydrates is lost, so retry until the editor opens.
async function openEditor(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Editor', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Course editor' })).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}
