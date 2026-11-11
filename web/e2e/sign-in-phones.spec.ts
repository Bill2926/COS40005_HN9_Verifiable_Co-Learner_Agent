import { expect, test, type Locator, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { resetDemoAccounts } from './reset-demo-accounts'

// The sign-in page is the seam: widths, type size, and tap size are what a Student
// meets on a phone. Desktop numbers are the page as it is at 1440 × 900.

const widths = [320, 375, 390, 430, 768, 1024, 1440] as const

test('the Swinburne logo sits above the sign-in card on a desktop and a phone', async ({ page }) => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 375, height: 667 },
  ]) {
    await page.setViewportSize(size)
    await page.goto('/sign-in')

    const logo = page.getByRole('img', { name: 'Swinburne University of Technology' })
    const form = page.locator('form')
    await expect(logo).toBeVisible()

    const logoBox = await logo.boundingBox()
    const formBox = await form.boundingBox()
    expect(logoBox).not.toBeNull()
    expect(formBox).not.toBeNull()
    expect(logoBox!.y + logoBox!.height).toBeLessThanOrEqual(formBox!.y)

    const email = page.getByLabel('Email')
    const password = page.getByLabel('Password')
    const signIn = page.getByRole('button', { name: 'Sign in', exact: true })
    for (const control of [email, password, signIn]) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height)
    }
  }
})

test('sign-in fits the listed widths and the desktop page stays as it is', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  const viewport = page.locator('meta[name="viewport"]')
  await expect(viewport).toHaveCount(1)
  await expect(viewport).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
  )

  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 })
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expectNoSidewaysScroll(page)

    const email = page.getByLabel('Email')
    const password = page.getByLabel('Password')
    const signIn = page.getByRole('button', { name: 'Sign in', exact: true })
    await expectReachable(page, email)
    await expectReachable(page, password)
    await expectReachable(page, signIn)

    if (width < 768) {
      expect(await fontSize(email)).toBeGreaterThanOrEqual(16)
      expect(await fontSize(password)).toBeGreaterThanOrEqual(16)
      expect(await boxHeight(email)).toBeGreaterThanOrEqual(44)
      expect(await boxHeight(password)).toBeGreaterThanOrEqual(44)
      expect(await boxHeight(signIn)).toBeGreaterThanOrEqual(44)

      const form = page.locator('form')
      const formBox = await form.boundingBox()
      expect(formBox).not.toBeNull()
      expect(formBox!.x).toBeCloseTo(16, 0)
      expect(formBox!.x + formBox!.width).toBeCloseTo(width - 16, 0)
      await expect(form).toHaveCSS('padding-left', '16px')
      await expect(form).toHaveCSS('padding-right', '16px')

      const emailBox = await email.boundingBox()
      const border = await form.evaluate(element => Number.parseFloat(getComputedStyle(element).borderLeftWidth))
      expect(emailBox).not.toBeNull()
      expect(emailBox!.x).toBeCloseTo(formBox!.x + border + 16, 0)
      expect(emailBox!.x + emailBox!.width).toBeCloseTo(formBox!.x + formBox!.width - border - 16, 0)
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await expectDesktopSignIn(page)
})

test('a short or landscape phone scrolls the sign-in form instead of clipping it', async ({ page }) => {
  for (const size of [
    { width: 667, height: 320 },
    { width: 320, height: 240 },
  ]) {
    await page.setViewportSize(size)
    await page.goto('/sign-in')
    await page.evaluate(() => document.fonts.ready)
    const signIn = page.getByRole('button', { name: 'Sign in', exact: true })
    const formBottom = await page.locator('form').evaluate(element => element.getBoundingClientRect().bottom + window.scrollY)
    const doc = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }))
    expect(formBottom).toBeLessThanOrEqual(doc.scrollHeight + 1)
    expect(doc.scrollHeight).toBeGreaterThan(doc.clientHeight)
    await expectReachable(page, signIn)
  }
})

test('the sign-in error fits at every width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill('not-a-student@example.com')
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Email or password is incorrect.')

  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 })
    await expectNoSidewaysScroll(page)
    await expectFits(alert)
    await expectReachable(page, alert)
  }
})

test('the workspace failure screen fits at every width', async ({ page }) => {
  const an = demoAccounts.find(account => account.displayName === 'An')
  if (!an) throw new Error('Demo account An is missing.')

  await resetDemoAccounts()
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/sign-in')
    await waitForApp(page)
    await page.route('**/turn', (route) => route.fulfill({
      status: 500,
      contentType: 'text/plain',
      body: 'no',
    }))
    await page.getByLabel('Email').fill(an.email)
    await page.getByLabel('Password').fill(an.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    const message = page.getByText('The workspace could not be opened.')
    await expect(message).toBeVisible()

    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 })
      await expectNoSidewaysScroll(page)
      await expectFits(message)
      await expectReachable(page, message)
    }

    await page.setViewportSize({ width: 320, height: 240 })
    await expectNoSidewaysScroll(page)
    await expectReachable(page, message)
  }
  finally {
    await resetDemoAccounts()
  }
})

async function expectDesktopSignIn(page: Page) {
  const header = page.locator('header')
  const main = page.locator('main')
  const form = page.locator('form')
  const email = page.getByLabel('Email')
  const password = page.getByLabel('Password')
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true })

  await expect(header).toHaveCSS('padding', '16px 32px')
  await expect(main).toHaveCSS('padding', '24px')
  await expect(form).toHaveCSS('padding', '32px')

  const formBox = await form.boundingBox()
  expect(formBox).not.toBeNull()
  expect(formBox!.width).toBe(384)
  expect(formBox!.x).toBeCloseTo(528, 0)

  const shellHeight = await header.evaluate(element => element.parentElement?.getBoundingClientRect().height ?? 0)
  expect(shellHeight).toBe(900)

  for (const field of [email, password]) {
    await expect(field).toHaveCSS('font-size', '14px')
    await expect(field).toHaveCSS('line-height', '20px')
    await expect(field).toHaveCSS('padding', '9px 13px')
    expect(await boxHeight(field)).toBe(38)
  }

  await expect(signIn).toHaveCSS('font-size', '14px')
  await expect(signIn).toHaveCSS('line-height', '20px')
  await expect(signIn).toHaveCSS('padding', '10px 16px')
  expect(await boxHeight(signIn)).toBe(40)
}

async function expectNoSidewaysScroll(page: Page) {
  const measured = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(measured.scrollWidth).toBe(measured.clientWidth)
}

async function expectReachable(page: Page, locator: Locator) {
  await expect(async () => {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) throw new Error('Element is not on screen.')
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  }).toPass()
}

async function expectFits(locator: Locator) {
  const fit = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      left: box.left,
      right: box.right,
      width: document.documentElement.clientWidth,
    }
  })
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth + 1)
  expect(fit.left).toBeGreaterThanOrEqual(0)
  expect(fit.right).toBeLessThanOrEqual(fit.width)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}

async function fontSize(locator: Locator): Promise<number> {
  const size = await locator.evaluate(element => getComputedStyle(element).fontSize)
  return Number.parseFloat(size)
}

async function boxHeight(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Element has no box.')
  return box.height
}
