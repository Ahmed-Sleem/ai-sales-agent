import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('app shell loads without page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#centerPanel')).toHaveCSS('position', 'relative');
  await expect(page.locator('#centerPanel')).toHaveCSS('z-index', '1');
  expect(errors).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('demo uses the existing feed and composer; its setting only changes the send path', async ({ page }) => {
  const aiProviderRequests: string[] = [];
  page.on('request', (request) => {
    if (/api\.openai\.com|api\.deepseek\.com|generativelanguage\.googleapis\.com|api\.groq\.com/i.test(request.url())) aiProviderRequests.push(request.url());
  });
  await page.goto('/');
  const chat = page.locator('#chatMessages');
  await expect(chat.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toBeVisible();
  await expect(page.locator('#chatInput')).toHaveCount(1);
  await expect(page.locator('#sendButton')).toHaveCount(1);
  await expect(page.locator('section[aria-label="Interactive no-key demo"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Play demo conversation/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Reset 3D city/i })).toHaveCount(0);
  await expect(page.locator('#demoModeToggle')).toHaveCount(0);

  await page.mouse.move(500, 400);
  await page.locator('#apiKeyBtn').click();
  const toggle = page.getByRole('switch', { name: 'Demo mode' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(chat.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(chat.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toHaveCount(1);
  await page.getByTitle('Close Settings').click();

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

test('mobile conversation menu opens as a stable drawer and closes through its controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#chatInput')).toBeVisible();
  const toggle = page.locator('#leftPanelToggleBtn');
  const panel = page.locator('#leftPanel');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('body')).toHaveClass(/mobile-sidebar-open/);
  await expect(page.locator('#conversationSearch')).toBeVisible();
  await expect(panel).toHaveCSS('opacity', '1');
  await page.waitForTimeout(450);
  const openBounds = await panel.boundingBox();
  expect(openBounds).not.toBeNull();
  expect(openBounds!.x).toBeGreaterThanOrEqual(0);
  await page.waitForTimeout(1200);
  await expect(page.locator('body')).toHaveClass(/mobile-sidebar-open/);
  await expect(page.locator('#conversationSearch')).toBeVisible();

  await page.locator('#mobileBackdrop').click({ position: { x: 360, y: 400 } });
  await expect(page.locator('body')).not.toHaveClass(/mobile-sidebar-open/);
  await toggle.click();
  await expect(page.locator('body')).toHaveClass(/mobile-sidebar-open/);
  await page.locator('#chatList .chat-item').first().click();
  await expect(page.locator('body')).not.toHaveClass(/mobile-sidebar-open/);
  await toggle.click();
  await expect(page.locator('body')).toHaveClass(/mobile-sidebar-open/);
  await page.locator('#mobileBackdrop').click({ position: { x: 360, y: 400 } });
  await expect(page.locator('body')).not.toHaveClass(/mobile-sidebar-open/);
});
