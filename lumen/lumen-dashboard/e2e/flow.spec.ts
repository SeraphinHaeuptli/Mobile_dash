import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * PLAN.md Phase 6 step 3 — the smoke flow that found two real bugs by hand
 * before it was automated (an inbox list overflowing its footer, and header
 * buttons swallowed by the react-grid-layout drag handle):
 *
 *   add -> configure -> drag -> persist -> reload -> remove
 *
 * Every widget falls back to deterministic sample data without credentials, so
 * this runs offline. Widgets whose connector cannot reach its upstream render a
 * "stale" pill instead of "sample" — both are fine here; what matters is that a
 * widget renders, keeps its settings, and survives a reload.
 */

/** Fail the test on any console error — that is how the RGL bug showed up. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** Start every test from the default dashboard so cases cannot bleed together. */
async function resetLayout(page: Page) {
  const res = await page.request.delete('/api/layout');
  expect(res.ok()).toBeTruthy();
}

/** DEFAULT_CONFIG places nine widgets. */
const DEFAULT_WIDGETS = 9;

/**
 * Wait until the dashboard has actually settled.
 *
 * Order matters: the grid is loaded with `ssr:false`, so before it mounts there
 * are no `.widget` nodes AND no `.skeleton` nodes. Asserting "no skeletons"
 * first would pass instantly against an empty page — which is exactly how an
 * earlier version of this file silently measured zero widgets.
 */
async function waitForDashboard(page: Page, expected = DEFAULT_WIDGETS) {
  await expect(page.locator('.widget')).toHaveCount(expected, { timeout: 20_000 });
  await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 20_000 });
}

const widget = (page: Page, title: string) => page.locator('.widget').filter({ hasText: title }).first();

test.beforeEach(async ({ page }) => {
  await resetLayout(page);
});

test.afterAll(async ({ request }) => {
  await request.delete('/api/layout');
});

test('dashboard renders the default layout with no console errors', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');

  await expect(page.locator('.brand')).toContainText('Lumen');
  await waitForDashboard(page);
  await expect(page.locator('.topbar')).toContainText(`${DEFAULT_WIDGETS} widgets`);
  expect(errors).toEqual([]);
});

test('every widget reports a data mode, and none renders an error state', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  // "Could not load data" is the ok:false path — no widget should hit it here.
  await expect(page.getByText('Could not load data')).toHaveCount(0);
  await expect(page.getByText('Widget crashed')).toHaveCount(0);
});

test('full flow: add -> configure -> drag -> persist -> reload -> remove', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await waitForDashboard(page);
  const initialCount = DEFAULT_WIDGETS;

  /* ---- add ---- */
  await page.getByRole('button', { name: '+ Widget' }).click();
  await expect(page.locator('.cards')).toBeVisible();
  await page.getByPlaceholder(/search/i).fill('forecast');
  await page.locator('.card').filter({ hasText: 'Forecast' }).first().click();

  await expect(page.locator('.widget')).toHaveCount(initialCount + 1);
  const forecast = widget(page, 'Forecast');
  await expect(forecast).toBeVisible();

  /* ---- configure ---- */
  // The gear lives in .widget-actions, which is the RGL draggableCancel region;
  // if that cancel ever regresses, this click is swallowed and the test fails.
  await forecast.locator('button[title="Widget settings"]').click();
  const modal = page.locator('.modal').filter({ hasText: 'Widget title' });
  await expect(modal).toBeVisible();

  await modal.locator('input[type="text"]').first().fill('Aarau Outlook');
  await modal.getByRole('button', { name: 'Save' }).click();
  await expect(modal).toBeHidden();

  const renamed = widget(page, 'Aarau Outlook');
  await expect(renamed).toBeVisible();

  /* ---- drag ---- */
  // Adding a widget puts the dashboard straight into edit mode (Dashboard.tsx
  // addWidget calls setEditing(true)), so the toolbar already reads "Done".
  await expect(page.getByRole('button', { name: /Done/ })).toBeVisible();

  // A new widget is placed at the bottom (addWidget uses maxY), so drag it
  // UPWARDS — dragging it further down would be a no-op and the assertion
  // below would pass without anything having moved.
  // The rename is written on the same 500ms debounce, so let it land first.
  await expect(page.locator('.topbar')).toContainText('saved', { timeout: 10_000 });
  const beforeDrag = await (await page.request.get('/api/layout')).json();
  const itemBefore = beforeDrag.items.find((it: { title?: string }) => it.title === 'Aarau Outlook');
  expect(itemBefore, 'rename must be persisted before the drag').toBeTruthy();
  const yBefore = itemBefore.y;
  expect(yBefore).toBeGreaterThan(0);

  const box = await renamed.boundingBox();
  expect(box).not.toBeNull();
  const handle = renamed.locator('.drag-handle');
  await handle.hover();
  await page.mouse.down();
  // Several small steps: RGL ignores a single instantaneous jump.
  await page.mouse.move(box!.x + box!.width / 2, box!.y - 240, { steps: 15 });
  await page.mouse.move(box!.x + box!.width / 2, box!.y - 300, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: /Done/ }).click();

  /* ---- persist ---- */
  // The PUT is debounced 500ms; wait for the header to confirm the write.
  await expect(page.locator('.topbar')).toContainText('saved', { timeout: 10_000 });

  const saved = await (await page.request.get('/api/layout')).json();
  const savedItem = saved.items.find((it: { title?: string }) => it.title === 'Aarau Outlook');
  expect(savedItem, 'renamed widget must be in the persisted layout').toBeTruthy();
  expect(savedItem.widgetId).toBe('weather.forecast');
  // The drag actually moved it, and that move was persisted.
  expect(savedItem.y, 'drag should have moved the widget up the grid').toBeLessThan(yBefore);

  /* ---- reload ---- */
  await page.reload();
  await waitForDashboard(page, initialCount + 1);
  const afterReload = widget(page, 'Aarau Outlook');
  await expect(afterReload).toBeVisible();

  // The custom title survived, which means settings round-tripped through disk.
  await expect(afterReload.locator('.widget-title')).toHaveText('Aarau Outlook');

  /* ---- remove ---- */
  await page.getByRole('button', { name: /Arrange/ }).click();
  await afterReload.locator('button[title="Remove"]').click();
  await expect(page.locator('.widget')).toHaveCount(initialCount);
  await expect(widget(page, 'Aarau Outlook')).toHaveCount(0);
  await page.getByRole('button', { name: /Done/ }).click();

  await expect(page.locator('.topbar')).toContainText('saved', { timeout: 10_000 });
  const finalLayout = await (await page.request.get('/api/layout')).json();
  expect(finalLayout.items.some((it: { title?: string }) => it.title === 'Aarau Outlook')).toBe(false);

  expect(errors).toEqual([]);
});

test('widget settings change the data that is rendered', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  const agenda = widget(page, 'Agenda');
  await agenda.locator('button[title="Widget settings"]').click();
  const modal = page.locator('.modal').filter({ hasText: 'Widget title' });
  await expect(modal).toBeVisible();

  // Narrow the agenda to a single day; the widget must re-fetch with the change.
  const daysInput = modal.locator('input[type="number"]').first();
  await daysInput.fill('1');
  await modal.getByRole('button', { name: 'Save' }).click();
  await expect(modal).toBeHidden();

  await expect(page.locator('.topbar')).toContainText('saved', { timeout: 10_000 });
  const saved = await (await page.request.get('/api/layout')).json();
  const item = saved.items.find((it: { widgetId: string }) => it.widgetId === 'gcal.agenda');
  expect(Number(item.settings.days)).toBe(1);
});

test('a widget body scrolls instead of overflowing its footer', async ({ page }) => {
  // Regression guard for the inbox bug: flex:1 + minHeight:0 without
  // overflow:auto let a long list push its footer out of the card.
  await page.goto('/');
  await waitForDashboard(page);

  for (const shell of await page.locator('.widget').all()) {
    const card = await shell.boundingBox();
    const body = await shell.locator('.widget-body').boundingBox();
    if (!card || !body) continue;
    // Allow a pixel of rounding, but the body must not extend past the card.
    expect(body.y + body.height).toBeLessThanOrEqual(card.y + card.height + 1);
  }
});

test('dashboard settings can reset the layout', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  await page.getByRole('button', { name: '+ Widget' }).click();
  await page.locator('.card').first().click();
  await expect(page.locator('.widget')).toHaveCount(DEFAULT_WIDGETS + 1);

  await page.locator('button[title="Dashboard settings"]').click();
  await page.getByRole('button', { name: /Reset/i }).first().click();

  await expect(page.locator('.widget')).toHaveCount(DEFAULT_WIDGETS);
});
