import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gpr_language', 'en'));
});

test('new visitors receive the specified Arabic greeting and RTL layout by default', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('gpr_language'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('#chatMessages')).toContainText('وعليكم السلام معاك ساره مسؤلة قسم المبيعات, حضرتك بتدور على ايه بالضبط؟');
});

test('app shell loads without page errors or a conversations sidebar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#centerPanel')).toHaveCSS('position', 'relative');
  await expect(page.locator('#centerPanel')).toHaveCSS('z-index', '1');
  await expect(page.locator('#leftPanel')).toHaveCount(0);
  await expect(page.locator('#leftPanelToggleBtn')).toHaveCount(0);
  await expect(page.locator('#mobileBackdrop')).toHaveCount(0);
  await expect(page.locator('#conversationSearch')).toHaveCount(0);
  await expect(page.locator('#mainWindow')).toHaveClass(/single-chat-layout/);
  await expect(page.locator('.thinking-log-card')).toHaveCount(0);
  await page.locator('#apiKeyBtn').click();
  await expect(page.getByText(/Workflow Parameters|إعدادات الاسترجاع/i)).toHaveCount(0);
  await expect(page.getByText(/Show thinking log|سجل التفكير/i)).toHaveCount(0);
  await expect(page.getByText(/Retrieval Exploration Cycles|دورات الاسترجاع/i)).toHaveCount(0);
  await page.getByTitle('Close Settings').click();
  expect(errors).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('synthetic analytics dashboard switches periods and returns to the same chat', async ({ page }) => {
  await page.goto('/');
  await page.locator('#dashboardToggleBtn').click();
  const dashboard = page.getByRole('region', { name: 'Synthetic demo analytics dashboard' });
  await expect(dashboard).toBeVisible();
  await expect(dashboard.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
  await expect(dashboard.locator('.analytics-kpi')).toHaveCount(4);
  await expect(dashboard.getByRole('heading', { name: 'Hot properties' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Hot locations' })).toBeVisible();
  await expect(dashboard.locator('.analytics-bar-chart')).toBeVisible();
  await expect(dashboard.getByText(/Synthetic demo analytics only/)).toBeVisible();

  await dashboard.getByRole('button', { name: 'Day' }).click();
  await expect(dashboard.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');
  await expect(dashboard.locator('.analytics-kpi').first()).toContainText('3');
  await dashboard.getByRole('button', { name: 'Month' }).click();
  await expect(dashboard.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
  await dashboard.getByRole('button', { name: 'Back to chat' }).click();
  await expect(page.locator('#chatInput')).toBeVisible();
  await expect(page.locator('#chatInput')).toHaveCount(1);
  await expect(page.locator('#sendButton')).toHaveCount(1);
});

test('static demo explains and can clear legacy browser-local API-key data', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rea_local_vault_profiles_v1', JSON.stringify([
      { id: 'old-profile', label: 'Old local profile', provider: 'deepseek', model: 'deepseek-chat', key: 'sample-placeholder-value', is_active: true },
    ]));
  });
  await page.goto('/');
  await page.locator('#apiKeyBtn').click();
  const safety = page.getByRole('region', { name: 'Static demo safety' });
  await expect(safety.getByText(/Older API-key data remains in this browser/)).toBeVisible();
  await safety.getByRole('button', { name: 'Clear saved local API-key data' }).click();
  await expect(safety.getByText(/Older API-key data remains in this browser/)).toHaveCount(0);
  await expect(page.locator('#demoModeToggle')).toHaveCount(0);
  await expect(page.getByPlaceholder(/API Key/i)).toHaveCount(0);
  await expect(page.getByTitle('Close Settings')).toBeVisible();
});

test('the local SVG Egypt map renders and drills into synthetic listings offline', async ({ page }) => {
  const remoteMapRequests: string[] = [];
  page.on('request', (request) => {
    if (/tile|mapbox|google.*maps|openstreetmap/i.test(request.url())) remoteMapRequests.push(request.url());
  });
  await page.goto('/');
  const map = page.locator('.egypt-map-svg');
  await expect(map).toBeVisible();
  await expect(map.locator('path').last()).toBeVisible();
  await expect(map.locator('.egypt-map-marker')).not.toHaveCount(0);
  await page.getByRole('button', { name: /^Cairo, \d+ synthetic demo properties$/i }).click();
  await expect(page.getByRole('navigation', { name: 'Map navigation' }).getByRole('button', { name: 'Cairo', exact: true })).toBeVisible();
  await expect(map.getByRole('button', { name: /^New Cairo, \d+ synthetic demo properties$/i })).toBeVisible();
  expect(remoteMapRequests).toEqual([]);
});

test('public static demo stays no-key and uses the existing feed and composer', async ({ page }) => {
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
  await expect(page.getByRole('region', { name: 'Static demo safety' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Static demo mode' })).toBeVisible();
  await expect(page.locator('#demoModeToggle')).toHaveCount(0);
  await expect(page.getByPlaceholder(/API Key/i)).toHaveCount(0);
  await expect(page.getByText(/there is no secure backend here/i)).toBeVisible();
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

test('completed demo can restart inline without adding a second composer or history menu', async ({ page }) => {
  await page.goto('/');
  const chat = page.locator('#chatMessages');
  const input = page.locator('#chatInput');
  const send = page.locator('#sendButton');
  const quickReplies = page.getByRole('group', { name: 'Demo quick replies' });
  await expect(chat.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toBeVisible();

  for (const answer of ['New Cairo', '8.5 million EGP', '160 square metres']) {
    await input.fill(answer);
    await send.click();
    await expect(input).toBeEnabled();
  }
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(chat.getByText(/The price is/i)).toBeVisible();
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await quickReplies.getByRole('button', { name: 'Cash' }).click();
  await quickReplies.getByRole('button', { name: 'Confirm interest' }).click();
  await quickReplies.getByRole('button', { name: 'Start another search' }).click();
  await expect(chat.getByText(/Peace be upon you\. I'm Sara, the sales manager\./i)).toHaveCount(1);
  await expect(chat.getByText('New Cairo', { exact: true })).toHaveCount(0);
  await expect(input).toHaveCount(1);
  await expect(send).toHaveCount(1);
  await expect(page.locator('#leftPanel, #leftPanelToggleBtn, #mobileBackdrop, #conversationSearch')).toHaveCount(0);
});

test('mobile single-chat layout has no conversations drawer or menu toggle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#chatInput')).toBeVisible();
  await expect(page.locator('#sendButton')).toBeVisible();
  await expect(page.locator('#leftPanel')).toHaveCount(0);
  await expect(page.locator('#leftPanelToggleBtn')).toHaveCount(0);
  await expect(page.locator('#mobileBackdrop')).toHaveCount(0);
  await expect(page.locator('#chatInput')).toHaveCount(1);
  await expect(page.locator('#sendButton')).toHaveCount(1);
});
