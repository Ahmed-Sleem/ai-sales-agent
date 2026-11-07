import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('app shell loads without page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#centerPanel')).toHaveCSS('position', 'relative');
  await expect(page.locator('#centerPanel')).toHaveCSS('z-index', '1');
  await expect(page.locator('#leftPanel')).toBeVisible();
  await expect(page.locator('#mainWindow')).not.toHaveClass(/left-panel-closed/);
  await expect(page.locator('#leftPanelToggleBtn')).toBeVisible();
  await page.mouse.move(700, 420);
  await page.waitForTimeout(3200);
  await expect(page.locator('#leftPanel')).toBeVisible();
  await expect(page.locator('#leftPanelToggleBtn')).toBeVisible();
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
  await page.evaluate(() => {
    type WindowWithDemoSnapshots = Window & { __demoSnapshots?: Array<{ typing: boolean; text: string }> };
    const target = window as WindowWithDemoSnapshots;
    target.__demoSnapshots = [];
    const root = document.getElementById('chatMessages');
    if (!root) return;
    new MutationObserver(() => {
      const content = root.querySelector('[data-demo-streaming="true"] .content');
      if (!content) return;
      target.__demoSnapshots?.push({
        typing: Boolean(content.querySelector('.typing-indicator')),
        text: content.textContent?.trim() ?? '',
      });
    }).observe(root, { subtree: true, childList: true, characterData: true });
  });
  await send('New Cairo');
  await expect(chat.getByText(/maximum budget/i)).toBeVisible();
  await expect(page.locator('#chatInput')).toBeEnabled();
  const streamSnapshots = await page.evaluate(() =>
    (window as Window & { __demoSnapshots?: Array<{ typing: boolean; text: string }> }).__demoSnapshots ?? []
  );
  expect(streamSnapshots.some((snapshot) => snapshot.typing)).toBe(true);
  expect(streamSnapshots.some((snapshot) => snapshot.text.length > 0 && snapshot.text.length < 49)).toBe(true);
  await send('8.5 million EGP');
  await expect(chat.getByText(/interior area/i)).toBeVisible();
  await send('160 square metres');
  await expect(chat.getByText(/I found one close match: Apartment 02/i)).toBeVisible();
  await expect(chat.getByText(/Would you like to hear the price/i)).toBeVisible();
  await expect(page.locator('#chatInput')).toBeEnabled();
  await expect(page.locator('#chatMessages .message')).toHaveCount(8);

  const quickReplies = page.getByRole('group', { name: 'Demo quick replies' });
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(chat.getByText(/The price is/i)).toBeVisible();
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(chat.getByText(/prefer to buy in cash/i)).toBeVisible();
  await quickReplies.getByRole('button', { name: 'Installments', exact: true }).click();
  await expect(chat.getByText(/illustrative payment plans/i)).toBeVisible();
  await expect(chat.getByText(/15% down over 8 years/i)).toBeVisible();
  await expect(chat.getByText(/20% down over 10 years/i)).toBeVisible();
  await quickReplies.getByRole('button', { name: 'Send demo photos' }).click();
  const demoImage = chat.getByRole('img', { name: /Synthetic demo photo of a bright/i });
  await expect(demoImage).toBeVisible();
  await expect(demoImage).toHaveJSProperty('naturalWidth', 1200);

  await quickReplies.getByRole('button', { name: 'Explore another' }).click();
  await expect(chat.getByText(/main reason this property is not suitable/i)).toBeVisible();
  await quickReplies.getByRole('button', { name: 'price', exact: true }).click();
  await expect(chat.getByText(/nearest other sample property is Apartment 01/i)).toBeVisible();
  await expect(chat.getByText(/It’s in .*Would you like to hear the price/i)).toBeVisible();
  const chatAccessibility = await new AxeBuilder({ page }).include('#centerPanel').analyze();
  expect(chatAccessibility.violations).toEqual([]);
  expect(aiProviderRequests).toEqual([]);
});

test('demo continues with a transparent closest listing when Alexandria has no exact 8m/200m match', async ({ page }) => {
  await page.goto('/');
  const chat = page.locator('#chatMessages');
  await expect(chat.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toBeVisible();
  const input = page.locator('#chatInput');
  const send = async (text: string) => {
    await input.fill(text);
    await page.locator('#sendButton').click();
  };

  await send('Alexandria');
  await expect(chat.getByText(/maximum budget/i)).toBeVisible();
  await expect(input).toBeEnabled();
  await send('EGP 8 million');
  await expect(chat.getByText(/interior area/i)).toBeVisible();
  await expect(input).toBeEnabled();
  await send('About 200 m²');
  await expect(chat.getByText(/couldn’t find an exact match for your budget and area/i)).toBeVisible();
  await expect(chat.getByText(/nearest sample property is Apartment 07/i)).toBeVisible();
  await expect(input).toBeEnabled();

  const quickReplies = page.getByRole('group', { name: 'Demo quick replies' });
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(chat.getByText(/The price is/i)).toBeVisible();
  await expect(input).toBeEnabled();
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(chat.getByText(/136 m², smaller than the approximate 200 m²/i)).toBeVisible();
  await expect(input).toBeEnabled();
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
