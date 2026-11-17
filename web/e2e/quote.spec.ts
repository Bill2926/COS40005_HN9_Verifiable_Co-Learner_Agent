import { expect, test, type Locator, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts } from './reset-demo-accounts'

// Selecting text in an agent reply or in the materials offers Ask, and the quote
// travels with the message and shows in the conversation.

const anAccount = demoAccounts[0]

test.beforeAll(async () => {
  await resetDemoAccounts()
})

test.afterAll(async () => {
  await resetDemoAccounts()
})

test('quotes an agent message, removes the quote, and shows it in the history', async ({ page }) => {
  await openWorkspace(page, { width: 1440, height: 900 })

  await selectText(page, page.getByRole('heading', { name: 'Getting Started with Programming and Python' }))
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toHaveCount(0)

  const message = page.getByRole('textbox', { name: 'Message' })
  await message.fill('Hello')
  await page.getByRole('button', { name: 'Send' }).click()
  const agent = page.locator('[data-quote-source="agent"]').last()
  await expect(agent).toBeVisible({ timeout: 60_000 })
  // The composer is disabled until the turn ends, and a quote removed while it
  // is still sending would be the disabled button, not the chip.
  await expect(message).toBeEnabled({ timeout: 60_000 })

  const quoted = await selectText(page, agent)
  expect(quoted.length).toBeGreaterThan(0)
  const ask = page.getByRole('button', { name: 'Ask', exact: true })
  await expect(ask).toBeVisible()
  await ask.click()
  const remove = page.getByRole('button', { name: 'Remove quote' })
  await expect(remove).toBeVisible()
  await remove.click()
  await expect(remove).toHaveCount(0)

  await selectText(page, agent)
  await ask.click()
  await message.fill('What does this mean?')
  await page.getByRole('button', { name: 'Send' }).click()
  const blockquote = page.locator('blockquote').filter({ hasText: quoted })
  await expect(blockquote).toBeVisible({ timeout: 60_000 })

  await page.reload()
  await expect(blockquote).toBeVisible({ timeout: 60_000 })
})

test.describe('on a phone', () => {
  test.use({ hasTouch: true })

  test('tapping Ask quotes a selection in the materials', async ({ page }) => {
    await openWorkspace(page, { width: 390, height: 844 })
    const material = page.locator('[data-quote-source="materials"]').first()
    await expect(material).toBeVisible()

    const quoted = await selectText(page, material)
    expect(quoted.length).toBeGreaterThan(0)
    const ask = page.getByRole('button', { name: 'Ask', exact: true })
    await expect(ask).toBeVisible()
    await ask.tap()
    await page.getByRole('tab', { name: 'Conversation', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Remove quote' })).toBeVisible()
    expect(await sidewaysScroll(page)).toBe(false)
    expect(quoted.length).toBeGreaterThan(0)
  })
})

async function selectText(page: Page, locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    const target = element.lastElementChild ?? element
    const range = document.createRange()
    range.selectNodeContents(target)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    return selection?.toString().trim() ?? ''
  })
}

async function openWorkspace(page: Page, size: { width: number, height: number }) {
  await page.setViewportSize(size)
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(anAccount.email)
  await page.getByLabel('Password').fill(anAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Getting Started with Programming and Python' })).toBeVisible({ timeout: 60_000 })
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
