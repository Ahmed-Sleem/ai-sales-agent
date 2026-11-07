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

test('demo mode uses the existing chat feed and composer for offline qualification and follow-up', async ({ page }) => {
  const aiProviderRequests: string[] = [];
  page.on('request', (request) => {
    if (/api\.openai\.com|api\.deepseek\.com|generativelanguage\.googleapis\.com|api\.groq\.com/i.test(request.url())) aiProviderRequests.push(request.url());
  });
  await page.goto('/');
  const dock = page.getByRole('group', { name: 'Chat and demo controls' });
  const toggle = dock.getByRole('switch', { name: 'Demo mode' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#chatInput')).toHaveCount(1);
  await expect(page.locator('section[aria-label="Interactive no-key demo"]')).toHaveCount(0);
  const chat = page.locator('#chatMessages');
  await expect(chat.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toBeVisible();
  await expect(page.locator('#chatInput')).toHaveAttribute('placeholder', /Demo mode/i);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(chat.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(chat.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toHaveCount(1);

  const input = page.locator('#chatInput');
  const send = async (text: string) => { await input.fill(text); await page.locator('#sendButton').click(); };
  await send('New Cairo');
  await expect(chat.getByText(/maximum budget/i)).toBeVisible();
  await send('8.5 million EGP');
  await expect(chat.getByText(/interior area/i)).toBeVisible();
  await send('160 square metres');
  await expect(chat.getByText(/closest illustrative match is Apartment 02/i)).toBeVisible();
  await expect(chat.getByText(/Would you like to hear the price/i)).toBeVisible();
  await expect(page.locator('#chatMessages .message')).toHaveCount(8);

  const quickReplies = page.getByRole('group', { name: 'Demo quick replies' });
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(chat.getByText(/illustrative price/i)).toBeVisible();
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(chat.getByText(/prefer to buy in cash/i)).toBeVisible();
  await quickReplies.getByRole('button', { name: 'Installments', exact: true }).click();
  await expect(chat.getByText(/illustrative payment plans/i)).toBeVisible();
  await quickReplies.getByRole('button', { name: 'Send demo photos' }).click();
  const demoImage = chat.getByRole('img', { name: /Synthetic demo photo of a bright/i });
  await expect(demoImage).toBeVisible();
  await expect(demoImage).toHaveJSProperty('naturalWidth', 1200);

  await quickReplies.getByRole('button', { name: 'Explore another' }).click();
  await expect(chat.getByText(/main reason this property is not suitable/i)).toBeVisible();
  await quickReplies.getByRole('button', { name: 'price', exact: true }).click();
  await expect(chat.getByText(/couldn’t find another illustrative match/i)).toBeVisible();
  const chatAccessibility = await new AxeBuilder({ page }).include('#centerPanel').analyze();
  expect(chatAccessibility.violations).toEqual([]);
  expect(aiProviderRequests).toEqual([]);
});

test('default demo switch and shared composer fit the mobile chat panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('switch', { name: 'Demo mode' });
  const composer = page.locator('#chatInput');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(composer).toBeVisible();
  await expect(page.locator('#chatMessages').getByText(/Peace be upon you/i)).toBeVisible();
  const toggleBounds = await toggle.boundingBox();
  const composerBounds = await composer.boundingBox();
  expect(toggleBounds).not.toBeNull();
  expect(composerBounds).not.toBeNull();
  expect(toggleBounds!.y + toggleBounds!.height).toBeLessThanOrEqual(844);
  expect(composerBounds!.y + composerBounds!.height).toBeLessThanOrEqual(844);
  await expect(page.locator('section[aria-label="Interactive no-key demo"]')).toHaveCount(0);
});

test('demo playback uses one current synthetic property and stages its details', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('switch', { name: 'Demo mode' })).toHaveAttribute('aria-checked', 'true');
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
