import { expect, test, type Page } from '@playwright/test'
import { demoAccounts, productOwnerAccount } from '../server/auth/demo-accounts'
import { adminClient } from './reset-demo-accounts'

// The administrator's pages are the seam: where sign-in lands, the
// Decisions/Settings split, and the verdict drawer.

const turnId = crypto.randomUUID()
let studentId = ''

test.beforeAll(async () => {
  const admin = adminClient()
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listed.error) throw new Error(listed.error.message)
  const an = listed.data.users.find(user => user.email === demoAccounts[0].email)
  if (!an) throw new Error('Demo account An is not seeded.')
  studentId = an.id
  const record = {
    time: new Date().toISOString(),
    studentId,
    turnId,
    agent: 'teacher' as const,
    proposedMove: 'explain_concept',
    proposedScope: 'lists_and_tuples',
    verdict: 'downgrade' as const,
    ruledMove: 'redirect_to_module',
    ruledScope: 'lists_and_tuples',
    ruleId: 'scope_requires_unlocked_module',
    reasonCode: 'MODULE_CLOSED',
    masteries: [{ moduleId: 'loops', mastery: 0.4 }],
    unlockedModuleIds: ['loops'],
    verifyShieldOn: true,
    masteryThreshold: 0.83,
    ruleChecks: [
      { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
      { ruleId: 'scope_in_course', passed: true, reasonCode: 'IN_COURSE' },
      { ruleId: 'scope_requires_unlocked_module', passed: false, reasonCode: 'MODULE_CLOSED' },
    ],
  }
  const inserted = await admin.from('decisions').insert({
    recorded_at: record.time,
    student_id: record.studentId,
    course_id: 'intro_python',
    turn_id: record.turnId,
    agent: record.agent,
    proposed_move: record.proposedMove,
    proposed_scope: record.proposedScope,
    verdict: record.verdict,
    ruled_move: record.ruledMove,
    ruled_scope: record.ruledScope,
    rule_id: record.ruleId,
    reason_code: record.reasonCode,
    masteries: record.masteries,
    unlocked_module_ids: record.unlockedModuleIds,
    verify_shield_on: record.verifyShieldOn,
    mastery_threshold: record.masteryThreshold,
    rule_checks: record.ruleChecks,
  })
  if (inserted.error) throw new Error(inserted.error.message)
})

test.afterAll(async () => {
  await adminClient().from('decisions').delete().eq('turn_id', turnId)
})

test('lands the administrator on Decisions and keeps them out of the course', async ({ page }) => {
  await signInAsOwner(page)
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Decisions', exact: true })).toBeVisible()

  await page.goto('/')
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('link', { name: 'Back to the course' })).toHaveCount(0)
})

test('splits Decisions and Settings, and the nav marks the current page', async ({ page }) => {
  await signInAsOwner(page)
  const nav = page.getByRole('navigation', { name: 'Administrator' })
  await expect(nav.getByRole('link', { name: 'Decisions' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /VerifyShield is/ })).toHaveCount(0)

  await nav.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/admin\/settings$/)
  await expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Decisions' })).not.toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('checkbox', { name: /VerifyShield is/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Language model' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('opens the verdict drawer with the deciding check highlighted, and Escape returns focus', async ({ page }) => {
  await signInAsOwner(page)
  await page.getByLabel('Student').fill(studentId)
  await page.getByRole('button', { name: 'Filter' }).click()

  const verdict = page.getByRole('button', { name: /downgrade → redirect_to_module/ }).first()
  await verdict.click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Close' })).toBeFocused()
  await expect(drawer.getByRole('listitem').filter({ hasText: 'role_table' })).toContainText('The role table lets this agent make this move.')
  const deciding = drawer.locator('[data-deciding="true"]')
  await expect(deciding).toHaveCount(1)
  await expect(deciding).toContainText('The move is about a module the student has not unlocked yet.')

  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(verdict).toBeFocused()

  await verdict.click()
  await drawer.getByRole('button', { name: 'Close' }).click()
  await expect(drawer).toBeHidden()
})

test('covers the screen with the drawer on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInAsOwner(page)
  await page.getByLabel('Student').fill(studentId)
  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: /downgrade → redirect_to_module/ }).first().click()
  const box = await page.getByRole('dialog').boundingBox()
  expect(box?.width).toBe(390)
  expect(box?.height).toBe(844)
})

test('tells a student both admin pages are for the administrator', async ({ page }) => {
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(demoAccounts[0].email)
  await page.getByLabel('Password').fill(demoAccounts[0].password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Course roadmap', exact: true })).toBeVisible({ timeout: 60_000 })

  for (const path of ['/admin', '/admin/settings']) {
    await page.goto(path)
    await expect(page.getByText('This page is for the administrator.')).toBeVisible()
  }
})

async function signInAsOwner(page: Page) {
  await page.goto('/sign-in')
  await waitForApp(page)
  await page.getByLabel('Email').fill(productOwnerAccount.email)
  await page.getByLabel('Password').fill(productOwnerAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Decisions', exact: true })).toBeVisible({ timeout: 60_000 })
  await waitForApp(page)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: object }) | null
    return Boolean(root?.__vue_app__)
  })
}
