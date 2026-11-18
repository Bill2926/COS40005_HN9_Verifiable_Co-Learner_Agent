import { expect, test, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts } from './reset-demo-accounts'

// The student profile page: reaching it by a full load, the checks on a
// picture, and a change that the workspace then shows.

const anAccount = demoAccounts[0]

const portraitPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const signedPortrait = /\/storage\/v1\/object\/sign\/student-files\/[0-9a-f-]+\/portrait/
// The over-size file only has to look like a PNG, so it starts like one.
const PNG_HEADER = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')

test.beforeEach(async () => {
  await resetDemoAccounts()
})

test('opens the profile page by a full load', async ({ page }) => {
  await signIn(page, anAccount)
  await page.goto('/profile')
  await waitForApp(page)

  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await expect(page.getByLabel('Display name')).toHaveValue('An')
  await expect(page.getByText(/SWB\d{4,}/)).toBeVisible()
  await expect(page.getByText(anAccount.email)).toBeVisible()
  await expect(page.getByText('Your activity in the app is recorded.')).toHaveCount(0)
  await expect(page.getByText('Upload picture', { exact: true })).toBeVisible()
})

test('shows initials in the navbar while there is no picture', async ({ page }) => {
  await signIn(page, anAccount)
  await expect(page.getByRole('heading', { name: 'Getting Started with Programming and Python' })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-navbar-initials]')).toHaveText('An')
  await expect(page.locator('[data-navbar-picture]')).toHaveCount(0)
})

test('refuses a picture of the wrong type or size before uploading it', async ({ page }) => {
  await openProfile(page)
  const picker = page.getByLabel('Upload picture')
  const picture = page.locator('[data-profile-picture]')

  await picker.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a picture') })
  await expect(page.getByRole('alert')).toHaveText('Use a JPEG, PNG or WebP picture.')

  const tooBig = Buffer.alloc(2 * 1024 * 1024 + 1)
  PNG_HEADER.copy(tooBig)
  await picker.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: tooBig })
  await expect(page.getByRole('alert')).toHaveText('The picture must be 2 MB or smaller.')

  await expect(picture).toHaveAttribute('src', '/portraits/student.png')
})

test('saves a new name and picture, and the conversation shows the picture', async ({ page }) => {
  await openProfile(page)

  const name = page.getByLabel('Display name')
  await name.fill('An Nguyen')
  await page.getByRole('button', { name: 'Save name' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')

  await page.getByLabel('Upload picture').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: portraitPng })
  await expect(page.getByRole('status')).toHaveText('Picture saved.')
  await expect(page.locator('[data-profile-picture]')).toHaveAttribute('src', signedPortrait)

  await page.getByRole('link', { name: 'Back to the workspace' }).click()
  await expect(page.locator('[data-navbar-picture]')).toHaveAttribute('src', signedPortrait)
  await expect(page.locator('[data-navbar-initials]')).toHaveCount(0)
  const message = page.getByRole('textbox', { name: 'Message' })
  await message.fill('Hello')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.locator('[data-portrait="student"] img')).toHaveAttribute('src', signedPortrait, { timeout: 60_000 })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/profile')
  await waitForApp(page)
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await expect(page.getByLabel('Display name')).toHaveValue('An Nguyen')
  await expect(page.locator('[data-profile-picture]')).toHaveAttribute('src', signedPortrait)
  expect(await sidewaysScroll(page)).toBe(false)
})

async function openProfile(page: Page) {
  await signIn(page, anAccount)
  await expect(page.getByRole('heading', { name: 'Getting Started with Programming and Python' })).toBeVisible({ timeout: 60_000 })
  // A link click navigates on the client, where the page is interactive as soon
  // as its first request resolves; a full load would hydrate a moment later.
  await page.locator('a[href="/profile"]').click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
}

async function sidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
}

async function signIn(page: Page, account: { email: string, password: string }) {
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/sign-in$/, { timeout: 60_000 })
  await waitForApp(page)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}
