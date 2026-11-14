import { expect, test } from '@playwright/test'

// The About page is public: what the co-learner is, how a turn works, the course, and the team.

const widths = [320, 390, 768, 1024, 1440] as const

test('the About page says what the co-learner is and leads to sign-in', async ({ page }) => {
  await page.goto('/home')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Python co-learner for first-year students')
  await expect(page.getByText('Python basics').first()).toBeVisible()

  await page.getByRole('main').getByRole('link', { name: 'Sign in to start' }).first().click()
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('sign-in links to the About page', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByRole('link', { name: 'About the co-learner' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('the About page fits every width and its controls are big enough to tap', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
    await page.goto('/home')
    await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)))

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `sideways scroll at ${width}`).toBeLessThanOrEqual(0)

    const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('a[href], button')]
      .filter(element => element.offsetParent && !element.matches('.sr-only'))
      .map(element => ({ text: element.textContent?.trim(), height: element.getBoundingClientRect().height }))
      .filter(target => target.height < 44 && window.innerWidth < 768))
    expect(small, `tap targets under 44px at ${width}`).toEqual([])
  }
})
