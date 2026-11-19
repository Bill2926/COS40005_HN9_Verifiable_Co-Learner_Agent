import { expect, test, type Page } from '@playwright/test'
import { demoAccounts, lecturerAccount } from '../server/auth/demo-accounts'
import { demoAccountsAreClear, resetDemoAccounts, studentNumberOf } from './reset-demo-accounts'

// The demonstration as the supervisors see it, written to pass against the
// public URL (REHEARSAL_URL) as well as a local dev server. The site runs the
// scripted agents (NUXT_MODEL=fake), so what the Teacher does is fixed: it
// proposes a plan, and revises it once a plan keeps failing.

const an = demoAccounts[0]
const binh = demoAccounts[1]
const wrongHello = 'def hello(name):\n    return name\n'
const rightHello = 'def hello(name):\n    # Greets the person by name.\n    return "Hello, " + name\n'
const turnLimitNotice = 'You have used your 60 turns for today. The agents will answer again tomorrow.'

test.beforeAll(async () => {
  await resetDemoAccounts()
  expect(await demoAccountsAreClear()).toBe(true)
})

test.afterAll(async () => {
  await resetDemoAccounts()
})

test('walks the plan, a failure, a revision, a reload, a review signal, a refusal and the turn limit', async ({ page, browser, baseURL }) => {
  await signIn(page, an)
  await expect(page.getByRole('heading', { name: 'Getting Started with Programming and Python' })).toBeVisible({ timeout: 60_000 })

  await test.step('agrees to the learning plan the Teacher suggests', async () => {
    const plan = page.getByRole('region', { name: 'Learning plan' })
    await expect(plan).toContainText('The Teacher suggests this plan', { timeout: 60_000 })
    await plan.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(plan).toContainText('Your plan for this module')
    await expect(plan).not.toContainText('Join two words')
  })

  await test.step('fails the sandbox check three times, and the Teacher revises the plan', async () => {
    await page.getByRole('button', { name: 'Practice', exact: true }).click()
    const editor = page.getByRole('textbox', { name: 'Python editor' })
    await expect(editor).toBeVisible()
    await replaceCode(page, wrongHello)

    const check = page.getByRole('region', { name: 'Practice check' })
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.getByRole('button', { name: 'Submit', exact: true }).click()
      await expect(check).toContainText('Failed: greeting for An', { timeout: 120_000 })
      await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled({ timeout: 60_000 })
    }

    await expect(page.getByRole('region', { name: 'Conversation' })).toContainText('Plan revised', { timeout: 60_000 })
    await expect(page.getByRole('region', { name: 'Learning plan' })).toContainText('Join two words', { timeout: 60_000 })
  })

  await test.step('keeps the revised plan after a reload', async () => {
    await page.reload()
    await waitForApp(page)
    const plan = page.getByRole('region', { name: 'Learning plan' })
    await expect(plan).toContainText('Your plan for this module', { timeout: 60_000 })
    await expect(plan).toContainText('Join two words')
  })

  await test.step('a pass with no run before it shows to the lecturer as a review signal', async () => {
    await page.getByRole('button', { name: 'Practice', exact: true }).click()
    await replaceCode(page, rightHello)
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Practice check' })).toContainText('Passed: greeting for An', { timeout: 120_000 })

    const lecturerPage = await (await browser.newContext({ baseURL })).newPage()
    await signIn(lecturerPage, lecturerAccount)
    await lecturerPage.goto(`/review/${await studentNumberOf(an.email)}`)
    const signals = lecturerPage.getByTestId('review-signals')
    await expect(signals).toContainText('A pass with no run before it', { timeout: 60_000 })
    await lecturerPage.context().close()
  })

  await test.step('refuses one student the data of another', async () => {
    const refused = await page.request.get('/api/staff/review', { params: { studentNumber: await studentNumberOf(binh.email) } })
    expect(refused.status()).toBe(403)
  })

  await test.step('stops the student after 60 proposing turns in a day', async () => {
    let notice = ''
    let sent = 0
    while (!notice.includes(turnLimitNotice) && sent < 70) {
      sent += 1
      const reply = await page.request.post('/turn', { data: { event: 'message', text: `Turn ${sent}` } })
      expect(reply.ok()).toBe(true)
      notice = await reply.text()
    }
    expect(notice).toContain(turnLimitNotice)
    // The failed submissions and the pass above each used a turn of the 60.
    expect(sent).toBeLessThan(60)
  })
})

async function replaceCode(page: Page, code: string) {
  const editor = page.getByRole('textbox', { name: 'Python editor' })
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(code)
  await expect(editor).toContainText('def hello')
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}

async function signIn(page: Page, account: { email: string, password: string }) {
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await waitForApp(page)
}
