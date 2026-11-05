import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('app shell loads without page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  expect(errors).toEqual([]);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('demo playback uses one current synthetic property and stages its details', async ({ page }) => {
  await page.goto('/');
  const playDemo = page.getByRole('button', { name: /Play demo conversation/i });
  await expect(playDemo).toBeVisible();
  await playDemo.click();

  await expect(page.getByText(/I found one closest synthetic match: Apartment 02 in New Cairo/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/The illustrative demo price is 8.45 million EGP/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/It is 165 m²\./i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Would you prefer cash or an installment plan/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Illustrative plan: 15% down, over 8 years/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Bamboo III|97 Hills|Palm Hills/i)).toHaveCount(0);
});
