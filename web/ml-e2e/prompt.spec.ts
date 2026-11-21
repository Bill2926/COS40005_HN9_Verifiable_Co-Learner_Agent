import { expect, test } from '@playwright/test'

test('an English prompt is scored by the local model and shown with its provenance', async ({ page }) => {
  await page.goto('/')
  const prompt = page.getByRole('textbox', { name: 'English prompt' })
  await prompt.fill('   ')
  await page.getByRole('button', { name: 'Classify prompt' }).click()
  await expect(page.getByRole('status')).toContainText('Enter a prompt')

  await prompt.fill('Why does my Python loop skip an item?')
  const scored = page.waitForResponse(response => response.url().endsWith('/api/classify/prompt'))
  await page.getByRole('button', { name: 'Classify prompt' }).click()
  const response = await scored
  expect(response.ok()).toBe(true)
  expect(await response.json()).toMatchObject({ task: 'prompt_content', label: 'other_content' })
  await expect(page.getByRole('status')).toContainText('Other content')
  await expect(page.getByText('0.1602', { exact: true })).toBeVisible()
  await expect(page.getByText('0.4136', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('prompt-content-v1')
  await page.getByText('Model details').click()
  await expect(page.getByText('289 prompts (10 positive)', { exact: true })).toBeVisible()
})
