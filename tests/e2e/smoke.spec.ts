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

test('full analytics dashboard opens in a new tab and fills the page', async ({ page }) => {
  await page.goto('/');
  const [dashboardPage] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('#dashboardToggleBtn').click(),
  ]);
  await dashboardPage.waitForLoadState();
  const dashboard = dashboardPage.getByRole('region', { name: 'Synthetic demo analytics dashboard' });
  await expect(dashboard).toBeVisible();
  await expect(dashboardPage.locator('.analysis-topbar')).toHaveCount(0);
  await expect(dashboardPage.getByRole('heading', { name: 'The Real Estate Agent', level: 1 })).toBeVisible();
  await expect(dashboardPage.locator('.analysis-page-title')).toHaveCSS('font-family', /Inter/);
  await expect(dashboardPage.locator('body')).toHaveCSS('overflow-y', 'auto');
  await expect(dashboardPage.locator('html')).toHaveCSS('scrollbar-width', 'none');
  await expect(dashboardPage.getByRole('link', { name: 'Back to workspace' })).toBeVisible();
  await expect(dashboard.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
  await expect(dashboard.locator('.analytics-kpi')).toHaveCount(8);
  await expect(dashboard.getByRole('heading', { name: 'Hot properties' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Hot locations' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Payment preferences' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Property rejection reasons' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Daily activity trend' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Sample inventory by city' })).toBeVisible();
  await expect(dashboard.getByText('Average asking price')).toBeVisible();
  await expect(dashboard.locator('.analytics-bar-chart')).toBeVisible();
  await expect(dashboard.locator('.analytics-trend-chart')).toBeVisible();
  await expect(dashboard.getByText(/Prices, photos, and units are synthetic illustrative data/)).toBeVisible();
  await expect(dashboard.getByText(/Synthetic demo analytics only/)).toBeVisible();
  const scrollState = await dashboardPage.evaluate(() => {
    const before = window.scrollY;
    window.scrollTo(0, 500);
    return { before, after: window.scrollY, height: document.documentElement.scrollHeight, viewport: window.innerHeight };
  });
  expect(scrollState.height).toBeGreaterThan(scrollState.viewport);
  expect(scrollState.after).toBeGreaterThan(scrollState.before);
  await dashboardPage.evaluate(() => window.scrollTo(0, 0));

  await dashboard.getByRole('button', { name: 'Day' }).click();
  await expect(dashboard.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');
  await expect(dashboard.locator('.analytics-kpi').first()).toContainText('3');
  await dashboard.getByRole('button', { name: 'Month' }).click();
  await expect(dashboard.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#chatInput')).toBeVisible();
  await expect(page.locator('#chatInput')).toHaveCount(1);
  await dashboardPage.getByRole('link', { name: 'Back to workspace' }).click();
  await expect(dashboardPage.locator('.egypt-map-svg')).toBeVisible();
  await expect(page.locator('.egypt-map-svg')).toBeVisible();
  await expect(page.locator('#chatInput')).toBeVisible();
  await expect(page.locator('#sendButton')).toHaveCount(1);
});

test('a location quick reply in the no-key demo focuses the map and attaches the selected city', async ({ page }) => {
  await page.goto('/');
  const quickReplies = page.getByRole('group', { name: 'Demo quick replies' });
  await quickReplies.getByRole('button', { name: 'Cairo', exact: true }).click();
  await expect(page.locator('#chatMessages').getByText(/maximum budget/i)).toBeVisible();
  await expect(page.locator('.map-focus-label')).toContainText('Cairo');
  await expect(page.locator('.map-cluster[data-map-location-id^="district:"]')).not.toHaveCount(0);
  await expect(page.locator('.map-selection-attachment[data-map-selection-id="city:cairo"]')).toBeVisible();
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

test('the bundled OSM map supports admin-region selection, zoom, and chat attachments offline', async ({ page }) => {
  const remoteMapRequests: string[] = [];
  page.on('request', (request) => {
    const requested = new URL(request.url());
    if (requested.origin !== new URL(page.url() || 'http://localhost').origin && /tile|mapbox|google.*maps|openstreetmap/i.test(request.url())) remoteMapRequests.push(request.url());
  });
  await page.goto('/');
  const map = page.locator('.egypt-map-svg');
  await expect(map).toBeVisible();
  await expect(map.locator('.map-osm-basemap')).toHaveAttribute('href', /egypt-openstreetmap\.svg\?v=5$/);
  const baseMapHref = await map.locator('.map-osm-basemap').getAttribute('href');
  const baseMapAsset = await page.request.get(new URL(baseMapHref!, page.url()).toString());
  expect(await baseMapAsset.text()).not.toContain('id="grid"');
  await expect(map.locator('.map-governorate-shape')).toHaveCount(29);
  await expect(page.getByRole('link', { name: /OpenStreetMap contributors/i })).toBeVisible();
  await expect(page.locator('.map-synthetic-legend')).toContainText('Illustrative property inventory');
  const zoom = page.locator('.map-control-stack span');
  const portSaidRegion = map.locator('.map-governorate-shape[data-governorate-id="EG-PTS"]');
  await portSaidRegion.press('Enter');
  await expect(portSaidRegion).toHaveClass(/selected/);
  await expect(portSaidRegion).toHaveCSS('fill', 'rgba(0, 0, 0, 0)');
  await expect(portSaidRegion).toHaveCSS('filter', /drop-shadow/);
  await expect(map.locator('.map-governorate-shape:not(.selected)').first()).toHaveCSS('stroke-opacity', '0');
  await expect(page.locator('.map-focus-label')).toHaveCSS('border-width', '0px');
  await expect(page.locator('.map-focus-label')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.map-focus-label span')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset map view' }).locator('svg')).toBeVisible();
  await expect(zoom).toHaveText('1×');
  await expect(map.locator('.map-detail-basemap')).toHaveCount(0);
  await expect(page.locator('#centerPanel').getByText(/Selected on map:/)).toContainText('Port Said');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).toHaveText('2.5×');
  await expect(map.locator('.map-detail-basemap')).toHaveAttribute('href', /egypt-city-roads\.svg\?v=5$/);
  await page.getByRole('button', { name: 'Reset map view' }).click();
  await expect(map.locator('.map-detail-basemap')).toHaveCount(0);
  await page.waitForTimeout(760);

  await expect(zoom).toHaveText('1×');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).not.toHaveText('1×');
  await page.waitForTimeout(180);
  const transformedMap = map;
  const midwayTransform = await transformedMap.getAttribute('style');
  const midwayZoom = Number(midwayTransform?.match(/scale\(([-\d.]+)\)/)?.[1] ?? 0);
  expect(midwayZoom).toBeGreaterThan(1);
  expect(midwayZoom).toBeLessThan(1.4);
  await expect(zoom).toHaveText('1.4×');
  const beforePan = await transformedMap.getAttribute('style');
  const mapBounds = await page.locator('.egypt-map-viewport').boundingBox();
  if (!mapBounds) throw new Error('Map viewport has no rendered bounds');
  await page.mouse.move(mapBounds.x + mapBounds.width * 0.72, mapBounds.y + mapBounds.height * 0.72);
  await page.mouse.down();
  await page.mouse.move(mapBounds.x + mapBounds.width * 0.76, mapBounds.y + mapBounds.height * 0.75);
  await page.mouse.up();
  await expect(transformedMap).not.toHaveAttribute('style', beforePan ?? '');
  await page.getByRole('button', { name: 'Reset map view' }).click();
  await expect(zoom).toHaveText('1×');
  await page.waitForTimeout(600);
  const wheelBounds = await page.locator('.egypt-map-viewport').boundingBox();
  if (!wheelBounds) throw new Error('Map viewport has no rendered bounds');
  const cursor = { x: wheelBounds.x + wheelBounds.width * 0.31, y: wheelBounds.y + wheelBounds.height * 0.42 };
  await page.evaluate(({ x, y }) => {
    const svg = document.querySelector('.egypt-map-svg');
    svg?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: -120 }));
  }, cursor);
  await expect(zoom).not.toHaveText('1×');
  await page.waitForTimeout(75);
  const wheelMidTransform = await transformedMap.getAttribute('style');
  const wheelMidZoom = Number(wheelMidTransform?.match(/scale\(([-\d.]+)\)/)?.[1] ?? 0);
  expect(wheelMidZoom).toBeGreaterThan(1);
  expect(wheelMidZoom).toBeLessThan(1.4);
  await expect(zoom).toHaveText('1.2×');
  await expect(transformedMap).toHaveAttribute('style', 'transform: translate3d(0px, 0px, 0px) scale(1);');
  const vectorMap = map.locator('.map-view-transform');
  const settledTransform = await vectorMap.getAttribute('transform');
  const settledMatch = settledTransform?.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
  expect(settledMatch).not.toBeNull();
  const settledZoom = Number(settledMatch?.[3]);
  const localCursor = await map.evaluate((svg, point) => {
    const viewport = svg.parentElement!;
    const scale = Math.min(svg.clientWidth / 598, svg.clientHeight / 548);
    const offsetX = (svg.clientWidth - 598 * scale) / 2;
    const offsetY = (svg.clientHeight - 548 * scale) / 2;
    return {
      x: (point.x - viewport.getBoundingClientRect().left - viewport.clientLeft - offsetX) / scale,
      y: (point.y - viewport.getBoundingClientRect().top - viewport.clientTop - offsetY) / scale,
    };
  }, cursor);
  const localCursorX = localCursor.x;
  const localCursorY = localCursor.y;
  expect(Math.abs(Number(settledMatch?.[1]) - localCursorX * (1 - settledZoom))).toBeLessThan(2);
  expect(Math.abs(Number(settledMatch?.[2]) - localCursorY * (1 - settledZoom))).toBeLessThan(2);
  await page.locator('.map-place[data-map-location-id="cairo"] circle.map-place-dot').click();
  await expect(page.locator('.map-focus-label')).toContainText('Cairo');
  await expect(map.locator('.map-cluster[data-map-location-id^="district:"]')).not.toHaveCount(0);
  await expect(zoom).toHaveText('1.2×');
  await expect(map.locator('.map-detail-basemap')).toHaveCount(0);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).toHaveText('2.1×');
  await expect(map.locator('.map-detail-basemap')).toHaveAttribute('href', /egypt-city-roads\.svg\?v=5$/);

  await page.locator('#chatInput').fill('Tell me about this area');
  await page.locator('#sendButton').click();
  await expect(page.locator('.map-selection-attachment[data-map-selection-id="city:cairo"]')).toBeVisible();
  expect(remoteMapRequests).toEqual([]);
});

test('one click on a unit marker opens its full detail view in the map work surface', async ({ page }) => {
  await page.goto('/');
  const map = page.locator('.egypt-map-svg');
  const activateMapMarker = async (selector: string) => {
    const marker = map.locator(selector);
    await expect(marker).toHaveCount(1);
    await marker.dispatchEvent('click', { bubbles: true });
    await page.waitForTimeout(740);
  };
  await activateMapMarker('.map-place[data-map-location-id="alexandria"]');
  await activateMapMarker('.map-cluster[data-map-location-id="district:san-stefano"]');
  await activateMapMarker('.map-cluster[data-map-location-id="community:alex-corniche-residence"]');
  await activateMapMarker('.map-property[data-map-location-id="demo-alexandria-apartment-03"]');

  const detail = page.locator('#rightPanel .property-detail-view');
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'Apartment 08' })).toBeVisible();
  await expect(detail.locator('.property-detail-community')).toContainText('Corniche Residence');
  await expect(detail.locator('.property-detail-price')).toContainText('EGP');
  await expect(detail.locator('.property-spec-grid article')).toHaveCount(3);
  await expect(detail.getByRole('group', { name: 'Property photos' })).toBeVisible();
  await expect(detail.locator('.property-detail-hero img')).toHaveJSProperty('naturalWidth', 500);
  await expect(page.locator('#rightPanel .egypt-map-svg')).toHaveCount(0);
  await detail.getByRole('button', { name: 'Back to map' }).click();
  await expect(page.locator('#rightPanel .egypt-map-svg')).toBeVisible();
});

test('the model demo can search and open a newly added Alexandria unit', async ({ page }) => {
  await page.goto('/');
  const chat = page.locator('#chatMessages');
  await page.getByRole('group', { name: 'Demo quick replies' }).getByRole('button', { name: 'Alexandria' }).click();
  await expect(chat.getByText(/maximum budget/i)).toBeVisible();
  await page.locator('#chatInput').fill('7.5 million EGP');
  await page.locator('#sendButton').click();
  await expect(chat.getByText(/interior area/i)).toBeVisible();
  await page.locator('#chatInput').fill('140 square metres');
  await page.locator('#sendButton').click();
  await expect(chat.getByText(/I found one close match: Apartment 08/i)).toBeVisible();
  await expect(page.locator('#rightPanel .property-detail-view h2')).toHaveText('Apartment 08');
  await expect(page.locator('#rightPanel .property-detail-hero img')).toHaveJSProperty('naturalWidth', 500);
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
  await expect(page.locator('.map-focus-label')).toContainText('New Cairo');
  await expect(chat.locator('.map-selection-attachment').first()).toContainText('New Cairo');
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
  await expect(page.locator('.property-detail-view')).toBeVisible();
  await expect(page.locator('.property-detail-summary')).toContainText('Apartment 02');
  await expect(page.locator('.property-detail-hero img')).toBeVisible();
  await expect(page.locator('#rightPanel .egypt-map-svg')).toHaveCount(0);
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
  await expect(chat.getByText(/It’s in .*Would you like to hear the price/i).last()).toBeVisible();
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
  await expect(chat.getByText(/nearest sample property is Apartment 08/i)).toBeVisible();
  await expect(input).toBeEnabled();

  const quickReplies = page.getByRole('group', { name: 'Demo quick replies' });
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(chat.getByText(/The price is/i)).toBeVisible();
  await expect(input).toBeEnabled();
  await quickReplies.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(chat.getByText(/155 m², smaller than the approximate 200 m²/i)).toBeVisible();
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
