import { expect, test } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts } from './reset-demo-accounts'

// Learn mode is the seam: the seeded module's blocks render in order, and a
// phone shows them without a sideways scroll.

const anAccount = demoAccounts.find(account => account.displayName === 'An')

test.beforeAll(async () => {
  await resetDemoAccounts()
})

test.afterAll(async () => {
  await resetDemoAccounts()
})

test('renders the seeded materials in Learn mode and stays within a phone width', async ({ page }) => {
  if (!anAccount) throw new Error('Demo account An is missing.')
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/sign-in')
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
  await page.getByLabel('Email').fill(anAccount.email)
  await page.getByLabel('Password').fill(anAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Getting Started with Programming and Python' })).toBeVisible({ timeout: 60_000 })

  await page.setViewportSize({ width: 320, height: 700 })
  const working = page.getByRole('region', { name: 'Working area', exact: true })
  await expect(working).toBeVisible()
  await expect(working.getByRole('heading', { name: 'A first program', exact: true })).toBeVisible()
  await expect(working.getByText('These materials belong to this module alone.', { exact: true })).toBeVisible()
  await expect(working.getByRole('textbox', { name: 'Example', exact: true })).toBeVisible()

  const diagram = working.locator('[data-material-image]')
  await expect(diagram.getByRole('img', { name: 'Diagram: A program leads to print().' })).toBeVisible()
  await expect(working.locator('svg[aria-roledescription]')).toHaveCount(0)
  const video = working.getByTitle('A first Python program')
  await expect(video).toBeVisible()
  await expect(video).toHaveAttribute('src', /youtube-nocookie\.com\/embed\//)

  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  for (const box of [await diagram.boundingBox(), await video.boundingBox()]) {
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(-1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  }

  const overflow = await page.evaluate(() => {
    const region = document.querySelector('[aria-label="Working area"]')
    const scroller = region?.querySelector('.overflow-x-hidden')
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panel: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
    }
  })
  expect(overflow.page).toBeLessThanOrEqual(0)
  expect(overflow.panel).toBeLessThanOrEqual(1)
})
