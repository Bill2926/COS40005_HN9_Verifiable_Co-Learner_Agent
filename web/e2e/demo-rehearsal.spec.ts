import { expect, test, type Locator, type Page } from '@playwright/test'
import { demoAccounts } from '../server/auth/demo-accounts'
import { demoAccountsAreClear, resetDemoAccounts } from './reset-demo-accounts'

const anAccount = demoAccounts.find(account => account.displayName === 'An')
const teacherReply = 'A running total has to be created before the loop, so each pass can add to the same number.'
const maiReply = 'wait, does the total live outside the loop? i\'m lost too.'
const studentMessage = 'Where does the total live?'
const resumedExercise = 'Count the even numbers'
const sumThatPrints = [
  'print("hello")',
  '',
  'def total(ds):',
  '    s = 0',
  '    for x in ds:',
  '        s = s + x',
  '    return s',
].join('\n')

test.beforeAll(async () => {
  await resetDemoAccounts()
  expect(await demoAccountsAreClear()).toBe(true)
})

test.afterAll(async () => {
  await resetDemoAccounts()
})

test('rehearses the supervisor demo as An', async ({ page }) => {
  if (!anAccount) throw new Error('Demo account An is missing.')

  await page.addInitScript(() => {
    document.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof Element) || target.closest('input, textarea, [role="textbox"]')) return
      const next = Number(sessionStorage.getItem('demo-clicks') ?? '0') + 1
      sessionStorage.setItem('demo-clicks', String(next))
    }, true)
  })

  await test.step('signs in as An and reaches a runnable editor within three clicks', async () => {
    await page.goto('/sign-in')
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.evaluate(() => sessionStorage.setItem('demo-clicks', '0'))

    await signIn(page, anAccount)

    await expect(page.getByRole('heading', { name: 'For loops' })).toBeVisible({ timeout: 60_000 })
    const topBar = page.locator('main > header')
    await expect(topBar).toContainText(anAccount.displayName)
    await expect(topBar).toContainText('Student')
    await page.getByRole('button', { name: 'Practice', exact: true }).click()

    const editor = page.getByRole('textbox', { name: 'Python editor' })
    await expect(editor).toBeVisible()
    await expect(editor).toContainText('def total')
    await expect(page.getByRole('button', { name: 'Sum of a list', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { name: 'Sum of a list' })).toHaveCount(0)
    await expect(page.getByText('Problem statement')).toBeVisible()
    await expect(page.getByText('Add up every number in a list. Use a for loop, and create the total before the loop so it survives every pass.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled()

    const clicks = await page.evaluate(() => Number(sessionStorage.getItem('demo-clicks')))
    expect(clicks, `${clicks} clicks to a runnable editor`).toBeGreaterThan(0)
    expect(clicks).toBeLessThanOrEqual(3)
  })

  await test.step('Run shows output and Submit shows 3/3', async () => {
    const editor = page.getByRole('textbox', { name: 'Python editor' })
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.insertText(sumThatPrints)
    await expect(editor).toContainText('print("hello")')
    await expect(editor).toContainText('return s')

    await page.getByRole('button', { name: 'Run', exact: true }).click()
    const printed = page.getByRole('heading', { name: 'Printed output' }).locator('xpath=following-sibling::pre')
    await expect(printed).toContainText('hello', { timeout: 180_000 })

    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    const practiceCheck = page.getByRole('region', { name: 'Practice check' })
    await expect(practiceCheck).toContainText('Passed: three numbers', { timeout: 60_000 })
    await expect(practiceCheck).toContainText('Passed: one number')
    await expect(practiceCheck).toContainText('Passed: empty list')
    await expect(conversation(page)).toContainText('3/3 tests passed', { timeout: 60_000 })
  })

  await test.step('a message shows a Teacher message followed by a Mai message, styled differently', async () => {
    await page.getByRole('textbox', { name: 'Message' }).fill(studentMessage)
    let releaseMessage = () => {}
    const messageHeld = new Promise<void>((resolve) => {
      releaseMessage = resolve
    })
    await page.route('**/turn', async (route) => {
      const body = route.request().postData() ?? ''
      if (body.includes('"event":"message"')) await messageHeld
      await route.continue()
    })
    const messageTurn = page.waitForResponse((response) => {
      const body = response.request().postData() ?? ''
      return response.url().endsWith('/turn') && body.includes('"event":"message"')
    })
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    const pending = conversation(page).locator('ol > li').last()
    try {
      await expect(pending).toContainText(anAccount.displayName)
      await expect(pending).toContainText(studentMessage)
    }
    finally {
      releaseMessage()
    }
    await messageTurn
    await page.unroute('**/turn')

    const items = conversation(page).locator('ol > li')
    await expect.poll(async () => {
      const texts = await items.allInnerTexts()
      const index = texts.findIndex(text => text.includes(studentMessage))
      return index < 0 ? [] : texts.slice(index, index + 3)
    }, { timeout: 60_000 }).toEqual([
      expect.stringContaining(studentMessage),
      expect.stringContaining(teacherReply),
      expect.stringContaining(maiReply),
    ])

    const texts = await items.allInnerTexts()
    const index = texts.findIndex(text => text.includes(studentMessage))
    const student = items.nth(index)
    const teacher = items.nth(index + 1)
    const mai = items.nth(index + 2)
    const label = (item: Locator) => item.locator('p').first()
    await expect(label(student)).toContainText(anAccount.displayName)
    await expect(label(student)).toContainText('Student')
    await expect(label(teacher)).toContainText('Teacher')
    await expect(label(teacher)).toContainText('Explanation')
    await expect(label(teacher)).not.toContainText('Instructor')
    await expect(label(mai)).toContainText('Mai')
    await expect(label(mai)).toContainText('Deskmate')
    expect(await background(teacher.locator('article'))).not.toBe(await background(mai.locator('article')))
    expect(await background(label(teacher).locator('span').first())).not.toBe(await background(label(mai).locator('span').first()))
    expect(await background(teacher.locator('article'))).not.toBe('rgba(0, 0, 0, 0)')
    expect(await background(label(teacher).locator('span').first())).not.toBe('rgba(0, 0, 0, 0)')
  })

  await test.step('toggling the VerifyShield trace shows that the VerifyShield was on', async () => {
    const trace = page.getByRole('heading', { name: 'VerifyShield: on' })
    await expect(trace).toHaveCount(0)
    await page.getByRole('switch', { name: 'VerifyShield trace' }).click()
    await expect(trace).toBeVisible()
  })

  let savedConversation: string[] = []
  await test.step('signing out and back in lands on the same exercise and conversation', async () => {
    await page.getByRole('textbox', { name: 'Python editor' }).press('Escape')
    const exerciseButton = page.getByRole('button', { name: resumedExercise, exact: true })
    await expect(async () => {
      if (await exerciseButton.getAttribute('aria-pressed') !== 'true') await exerciseButton.click()
      await expect(exerciseButton).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 })
    }).toPass({ timeout: 20_000 })
    await expect(conversation(page)).toContainText(`Exercise · ${resumedExercise}`)
    savedConversation = await conversationLines(conversation(page))

    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await signIn(page, anAccount)

    await expect.poll(async () => conversationLines(conversation(page)), { timeout: 60_000 }).toEqual(savedConversation)
    await page.getByRole('button', { name: 'Practice', exact: true }).click()
    await expect(page.getByRole('button', { name: resumedExercise, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Sum of a list', exact: true })).toHaveAttribute('aria-pressed', 'false')
  })

  await test.step('demo accounts are left clear', async () => {
    await resetDemoAccounts()
    expect(await demoAccountsAreClear()).toBe(true)
  })
})

function conversation(page: Page): Locator {
  return page.getByRole('region', { name: 'Conversation' })
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}

async function conversationLines(region: Locator): Promise<string[]> {
  return region.locator('ol > li').allInnerTexts()
}

async function background(locator: Locator): Promise<string> {
  return locator.evaluate(element => getComputedStyle(element).backgroundColor)
}

async function signIn(page: Page, account: { email: string, password: string }) {
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}
