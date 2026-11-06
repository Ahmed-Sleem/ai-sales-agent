import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('app shell loads without page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  // Keep the chat panel above the fixed NightSky canvas; DOM visibility alone misses paint-order bugs.
  await expect(page.locator('#centerPanel')).toHaveCSS('position', 'relative');
  await expect(page.locator('#centerPanel')).toHaveCSS('z-index', '1');
  expect(errors).toEqual([]);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('interactive demo runs offline through qualification, gated disclosure, photos, and rejection capture', async ({ page }) => {
  const aiProviderRequests: string[] = [];
  page.on('request', (request) => {
    if (/api\.openai\.com|api\.deepseek\.com|generativelanguage\.googleapis\.com|api\.groq\.com/i.test(request.url())) aiProviderRequests.push(request.url());
  });
  await page.goto('/');
  const demo = page.getByRole('region', { name: 'Interactive no-key demo' });
  await demo.getByRole('button', { name: 'Start interactive demo' }).click();
  await expect(demo.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toBeVisible();

  const input = demo.getByRole('textbox', { name: 'Write your demo reply' });
  const send = () => demo.getByRole('button', { name: 'Send', exact: true }).click();
  await input.fill('New Cairo'); await send();
  await expect(demo.getByText(/maximum budget/i)).toBeVisible();
  await input.fill('8.5 million EGP'); await send();
  await expect(demo.getByText(/interior area/i)).toBeVisible();
  await input.fill('160 square metres'); await send();
  await expect(demo.getByText(/closest illustrative match is Apartment 02/i)).toBeVisible();
  await expect(demo.getByText(/Would you like to hear the price/i)).toBeVisible();

  await demo.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(demo.getByText(/illustrative price/i)).toBeVisible();
  await demo.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(demo.getByText(/prefer to buy in cash/i)).toBeVisible();
  await demo.getByRole('button', { name: 'Installments', exact: true }).click();
  await expect(demo.getByText(/illustrative payment plans/i)).toBeVisible();
  await demo.getByRole('button', { name: 'Send demo photos' }).click();
  const demoImage = demo.getByRole('img', { name: /Synthetic demo photo of a bright/i });
  await expect(demoImage).toBeVisible();
  await expect(demoImage).toHaveJSProperty('naturalWidth', 1200);
  const demoAccessibility = await new AxeBuilder({ page }).include('section[aria-label="Interactive no-key demo"]').analyze();
  expect(demoAccessibility.violations).toEqual([]);
  await demo.getByRole('button', { name: 'Explore another' }).click();
  await expect(demo.getByText(/main reason this property is not suitable/i)).toBeVisible();
  await demo.getByRole('button', { name: 'price', exact: true }).click();
  await expect(demo.getByText(/couldn’t find another illustrative match/i)).toBeVisible();
  expect(aiProviderRequests).toEqual([]);
});

test('demo playback uses one current synthetic property and stages its details', async ({ page }) => {
  await page.goto('/');
  const playDemo = page.locator('button[data-demo-ready]');
  await expect(playDemo).toBeVisible();
  await expect(playDemo).toHaveAttribute('data-demo-ready', 'true');
  await expect(playDemo).toBeEnabled();
  const bounds = await playDemo.boundingBox();
  if (!bounds) throw new Error('Demo button has no visible bounds');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.locator('#mainWindow')).not.toHaveClass(/dock-hidden/);
  await playDemo.click();
  await expect(playDemo).toHaveText(/Playing/i);

  await expect(page.getByText(/I found one closest synthetic match: Apartment 02 in New Cairo/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/The illustrative demo price is 8.45 million EGP/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/It is 165 m²\./i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Would you prefer cash or an installment plan/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Illustrative plan: 15% down, over 8 years/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Bamboo III|97 Hills|Palm Hills/i)).toHaveCount(0);
});
