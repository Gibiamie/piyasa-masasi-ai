// MIC-P0-003: `/mic-desktop/` lost all navigation at <=820px because the
// `<nav class="bottom">` markup was missing (desktop.css already had the CSS
// rule to show it). Verifies navigation is actually reachable and clickable
// across the full required viewport matrix, on both mic/ and mic-desktop/.
const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test(`mic/ bottom nav reachable and clickable at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('mic/');
    const bottomNav = page.locator('nav.bottom');
    await expect(bottomNav).toBeVisible();
    const portfolioBtn = bottomNav.locator('[data-view="portfolio"]');
    await expect(portfolioBtn).toBeVisible();
    await portfolioBtn.click();
    await expect(page.locator('#portfolio')).toHaveClass(/active/);
  });

  test(`mic-desktop/ navigation reachable and clickable at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('mic-desktop/');
    const isNarrow = vp.width <= 820;
    const bottomNav = page.locator('nav.bottom');
    const sidebar = page.locator('.sidebar');

    if (isNarrow) {
      // Core MIC-P0-003 regression check: below the breakpoint the bottom
      // nav markup must exist AND be visible, not just present in the DOM.
      await expect(bottomNav).toBeVisible();
      const portfolioBtn = bottomNav.locator('[data-view="portfolio"]');
      await expect(portfolioBtn).toBeVisible();
      await portfolioBtn.click();
      await expect(page.locator('#portfolio')).toHaveClass(/active/);
    } else {
      await expect(sidebar).toBeVisible();
      const portfolioBtn = sidebar.locator('[data-view="portfolio"]');
      await expect(portfolioBtn).toBeVisible();
      await portfolioBtn.click();
      await expect(page.locator('#portfolio')).toHaveClass(/active/);
    }

    // No horizontal scroll regression at any width in the matrix.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow of ${overflow}px at ${vp.name}`).toBeLessThanOrEqual(1);
  });
}
