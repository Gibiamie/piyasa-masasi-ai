// MIC-P0-004: technical-methods-v27.js boot() called navb.querySelector(...)
// on a null navb whenever `.bottom` didn't exist (true on desktop before
// MIC-P0-003 was fixed), throwing an uncaught TypeError. The release-checklist
// acceptance gate is literally "zero uncaught errors" (docs/RELEASE_CHECKLIST.md),
// so this asserts zero `pageerror` events (uncaught exceptions) -- not zero
// console.error noise, which Chrome also emits for any failed network request
// (e.g. mic/data/history/*.json, deliberately excluded from this migration
// per docs/MIGRATION_PLAN.md and already handled gracefully by app code with
// a try/catch fallback message).
const { test, expect } = require('@playwright/test');

async function collectPageErrors(page, path, viewport) {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.setViewportSize(viewport);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  return pageErrors;
}

test('mic-desktop/ Technical Methods: zero uncaught errors at desktop width (sidebar nav)', async ({ page }) => {
  const pageErrors = await collectPageErrors(page, 'mic-desktop/', { width: 1366, height: 768 });

  // Known residual gap (documented in docs/REMEDIATION_REGISTER.md MIC-P0-003
  // and tracked under MIC-P1-001): technical-methods-v27.js's installNav()
  // only ever injects into `.bottom`, which is `display:none` above 820px.
  // Assert the documented state explicitly so a future fix of MIC-P1-001 is
  // caught by this test failing (button becomes visible) instead of silently
  // going unnoticed.
  const methodsNavBtn = page.locator('[data-view="methods"]');
  await expect(methodsNavBtn).toBeAttached({ timeout: 15000 });
  await expect(methodsNavBtn).toBeHidden();

  expect(pageErrors, `uncaught page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
});

test('mic-desktop/ Technical Methods: zero uncaught errors at narrow width (bottom nav), reachable and clickable', async ({ page }) => {
  const pageErrors = await collectPageErrors(page, 'mic-desktop/', { width: 390, height: 844 });

  const methodsNavBtn = page.locator('[data-view="methods"]');
  await expect(methodsNavBtn).toBeVisible({ timeout: 15000 });
  await methodsNavBtn.click();
  await expect(page.locator('#methods')).toHaveClass(/active/);
  await page.waitForTimeout(300);

  expect(pageErrors, `uncaught page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
});

test('mic/ Technical Methods: zero uncaught errors on mobile, reachable and clickable', async ({ page }) => {
  const pageErrors = await collectPageErrors(page, 'mic/', { width: 390, height: 844 });

  const methodsNavBtn = page.locator('[data-view="methods"]');
  await expect(methodsNavBtn).toBeVisible({ timeout: 15000 });
  await methodsNavBtn.click();
  await expect(page.locator('#methods')).toHaveClass(/active/);
  await page.waitForTimeout(300);

  expect(pageErrors, `uncaught page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
});
