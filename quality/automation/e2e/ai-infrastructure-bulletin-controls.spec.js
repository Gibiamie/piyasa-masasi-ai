const { test, expect } = require('@playwright/test');

const URL = '/ai-infrastructure-bulletin/';
const EXPERIENCE_KEY = 'piyasa-masasi-ai.experience-level';

test.describe('AI bulletin interactive controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(key => localStorage.removeItem(key), EXPERIENCE_KEY);
    await page.goto(URL);
    await expect(page.locator('#freshness')).not.toHaveText(/Yükleniyor|Loading/, { timeout: 25000 });
  });

  test('global search finds LUNR and opens its research drawer', async ({ page }) => {
    const search = page.locator('#globalSearch');
    await search.fill('lunr');
    await expect(page.locator('#globalSearchResults')).toHaveClass(/open/);
    const result = page.locator('#globalSearchResults .search-result[data-ticker="LUNR"]');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Intuitive Machines');
    await result.click();
    await expect(page.locator('#assetDrawer')).toHaveClass(/open/);
    await expect(page.locator('#drawerTitle')).toContainText('Intuitive Machines');
  });

  test('enter on an exact search result opens the asset', async ({ page }) => {
    await page.locator('#globalSearch').fill('LUNR');
    await page.locator('#globalSearch').press('Enter');
    await expect(page.locator('#assetDrawer')).toHaveClass(/open/);
    await expect(page.locator('.drawer-symbol')).toHaveText('LUNR');
  });

  test('experience levels materially change research density and persist', async ({ page }) => {
    await page.locator('.tab[data-view="settings"]').click();
    const select = page.locator('#experienceLevel');

    await select.selectOption('beginner');
    await expect(page.locator('html')).toHaveAttribute('data-experience', 'beginner');
    await expect(page.locator('#experienceStatus')).toContainText('Başlangıç görünümü uygulandı');
    await page.locator('.tab[data-view="briefing"]').click();
    await expect(page.locator('#evaluations .research-card').first()).toBeVisible();
    await expect(page.locator('#evaluations .research-card').first()).not.toContainText('252D');
    await expect(page.locator('#evaluations .experience-detail-grid')).toHaveCount(0);

    await page.locator('.tab[data-view="settings"]').click();
    await select.selectOption('advanced');
    await expect(page.locator('#experienceStatus')).toContainText('Gelişmiş görünüm uygulandı');
    await page.locator('.tab[data-view="briefing"]').click();
    await expect(page.locator('#evaluations .research-card').first()).toContainText('252D');
    await expect(page.locator('#evaluations .experience-detail-grid').first()).toBeVisible();
    await expect(page.locator('#evaluations .research-context').first()).toBeVisible();

    await page.locator('.tab[data-view="settings"]').click();
    await select.selectOption('professional');
    await expect(page.locator('#experienceStatus')).toContainText('Profesyonel görünüm uygulandı');
    await page.locator('.tab[data-view="briefing"]').click();
    await expect(page.locator('#evaluations .professional-meta').first()).toBeVisible();

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-experience', 'professional');
    await page.locator('.tab[data-view="settings"]').click();
    await expect(page.locator('#experienceLevel')).toHaveValue('professional');
  });

  test('experience status follows English mode', async ({ page }) => {
    await page.locator('.tab[data-view="settings"]').click();
    await page.locator('#experienceLevel').selectOption('advanced');
    await page.locator('#languageToggle').click();
    await expect(page.locator('#experienceStatus')).toContainText('Advanced view applied');
  });
});
