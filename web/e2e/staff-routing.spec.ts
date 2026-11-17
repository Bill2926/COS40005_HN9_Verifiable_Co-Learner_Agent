import { expect, test, type Page } from '@playwright/test'
import { lecturerAccount, productOwnerAccount } from '../server/auth/demo-accounts'

// The staff pages are the seam: where each role lands, that neither role can
// stay on the course, and that a person with both roles gets a switch.

const widths = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
] as const

for (const width of widths) {
  test(`lands a lecturer on /lecturer and away from the course at ${width.name} width`, async ({ page }) => {
    await page.setViewportSize(width.viewport)
    await signIn(page, lecturerAccount)
    await expect(page).toHaveURL(/\/lecturer$/)
    await expect(page.getByRole('heading', { name: 'Lecturer', exact: true })).toBeVisible()

    await page.goto('/')
    await expect(page).toHaveURL(/\/lecturer$/)
    await expect(page.getByRole('link', { name: 'Back to the course' })).toHaveCount(0)
  })

  test(`lands the product owner on /admin and away from the course at ${width.name} width`, async ({ page }) => {
    await page.setViewportSize(width.viewport)
    await signIn(page, productOwnerAccount)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Decisions', exact: true })).toBeVisible()

    await page.goto('/')
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('link', { name: 'Back to the course' })).toHaveCount(0)
  })
}

test('gives each single staff role no switch to the other', async ({ page }) => {
  await signIn(page, lecturerAccount)
  await expect(page.getByRole('link', { name: 'Admin page' })).toHaveCount(0)

  await signOut(page)
  await signIn(page, productOwnerAccount)
  await expect(page.getByRole('link', { name: 'Lecturer page' })).toHaveCount(0)
})

test('switches a person with both staff roles from the admin pages to the lecturer page', async ({ page }) => {
  await signIn(page, productOwnerAccount)
  await expect(page).toHaveURL(/\/admin$/)
  // The demo owner is not a lecturer. Answer the header's role check as a
  // lecturer, which is what the server does for a person who does both jobs.
  await page.route('**/api/lecturer', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ courses: [] }),
  }))
  await page.reload()
  const switchLink = page.getByRole('link', { name: 'Lecturer page' })
  await expect(switchLink).toBeVisible()
  await switchLink.click()
  await expect(page).toHaveURL(/\/lecturer$/)
})

test('switches a person with both staff roles from the lecturer page to the admin pages', async ({ page }) => {
  await signIn(page, lecturerAccount)
  await expect(page).toHaveURL(/\/lecturer$/)
  // The demo lecturer is not the product owner. Answer the page's role check
  // as one, which is what the server does for a person who does both jobs.
  await page.route('**/api/admin', (route) => {
    const body = route.request().postDataJSON() as { event?: string } | null
    if (route.request().method() === 'POST' && body?.event === 'role') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productOwner: true }) })
    }
    return route.continue()
  })
  await page.reload()
  const switchLink = page.getByRole('link', { name: 'Admin page' })
  await expect(switchLink).toBeVisible()
  await switchLink.click()
  await expect(page).toHaveURL(/\/admin$/)
})

async function signIn(page: Page, account: { email: string, password: string }) {
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await waitForApp(page)
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}
