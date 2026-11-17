import { expect, test, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts } from './reset-demo-accounts'

// The composer's `@` menu and chip, and the deskmate switch hiding Mai from it.

const anAccount = demoAccounts.find(account => account.displayName === 'An')

test.beforeAll(async () => {
  await resetDemoAccounts()
})

test.afterAll(async () => {
  await resetDemoAccounts()
})

test('an @ at the start opens the menu, and the choice becomes a removable chip', async ({ page }) => {
  await openWorkspace(page)
  const message = page.getByRole('textbox', { name: 'Message' })

  await message.fill('@')
  const menu = page.getByRole('listbox', { name: 'Address an agent' })
  await expect(menu.getByRole('option')).toHaveText(['Teacher', 'Mai'])
  await menu.getByRole('option', { name: 'Mai' }).click()
  await expect(menu).toHaveCount(0)
  await expect(page.locator('[data-addressee-chip]')).toContainText('@Mai')
  await expect(message).toHaveValue('')

  await page.getByRole('button', { name: 'Stop addressing Mai' }).click()
  await expect(page.locator('[data-addressee-chip]')).toHaveCount(0)

  await message.fill('hi @')
  await expect(menu).toHaveCount(0)
})

test('switching the deskmate off hides Mai from the menu', async ({ page }) => {
  await openWorkspace(page)
  const deskmate = page.getByRole('switch', { name: 'Deskmate' })
  await expect(deskmate).toHaveAttribute('aria-checked', 'true')
  await deskmate.click()
  await expect(deskmate).toHaveAttribute('aria-checked', 'false')

  await page.getByRole('textbox', { name: 'Message' }).fill('@')
  await expect(page.getByRole('listbox', { name: 'Address an agent' }).getByRole('option')).toHaveText(['Teacher'])

  await page.reload()
  await expect(page.getByRole('switch', { name: 'Deskmate' })).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('switch', { name: 'Deskmate' }).click()
  await expect(page.getByRole('switch', { name: 'Deskmate' })).toHaveAttribute('aria-checked', 'true')
})

async function openWorkspace(page: Page) {
  if (!anAccount) throw new Error('Demo account An is missing.')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(anAccount.email)
  await page.getByLabel('Password').fill(anAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Getting Started with Programming and Python' })).toBeVisible({ timeout: 60_000 })
  await waitForApp(page)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}
