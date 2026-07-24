// MIC-P0-005: static IPO calendar data used to contain personalized buy/join
// instructions independent of user profile. The static-data-field-absence
// check already has a passing logic-level test (verify_p0-005.logic.js);
// this covers the actual rendered UI, in a real browser, against the
// actually-served mic/ipo-calendar-v26.js.
const { test, expect } = require('@playwright/test');
const { seedState, COMPLETE_PROFILE } = require('./fixtures');

test('IPO calendar view renders a profile-gated assessment with no personalized buy/join wording, no profile', async ({ page }) => {
  await seedState(page, { profile: null, portfolio: [] });
  await page.goto('/mic/');

  const ipoNavBtn = page.locator('[data-view="ipo"]');
  await expect(ipoNavBtn).toBeVisible({ timeout: 15000 });
  await ipoNavBtn.click();
  await expect(page.locator('#ipo')).toHaveClass(/active/);

  const list = page.locator('#ipoList');
  await expect(list).toBeVisible();
  await expect(list.locator('.ipoAssessment').first()).toBeVisible({ timeout: 15000 });

  // Profile is incomplete -> every item must show the locked assessment, never a buy/join call.
  const assessments = await list.locator('.ipoAssessment strong').allInnerTexts();
  expect(assessments.length).toBeGreaterThan(0);
  for (const label of assessments) {
    expect(label).toBe('KARAR ÜRETİLEMEZ');
  }

  const bodyText = await list.innerText();
  expect(bodyText, 'no personalized join/buy instruction should ever render').not.toMatch(/KATIL|\bAL\b|SATIN AL/);
});

test('IPO calendar view shows neutral assessment (no buy/join wording) with a complete, unlocked profile', async ({ page }) => {
  await seedState(page, { profile: COMPLETE_PROFILE, portfolio: [] });
  await page.goto('/mic/');

  const ipoNavBtn = page.locator('[data-view="ipo"]');
  await expect(ipoNavBtn).toBeVisible({ timeout: 15000 });
  await ipoNavBtn.click();

  const list = page.locator('#ipoList');
  await expect(list.locator('.ipoAssessment').first()).toBeVisible({ timeout: 15000 });

  const assessments = await list.locator('.ipoAssessment strong').allInnerTexts();
  expect(assessments.length).toBeGreaterThan(0);
  for (const label of assessments) {
    // With an empty, unlocked portfolio and a complete profile, every item should
    // resolve to either the neutral no-advice label or a stale-verification gate --
    // never a personalized participation instruction.
    expect(['BİREYSEL ÖNERİ YOK', 'VERİ DOĞRULAMA GEREKLİ']).toContain(label);
  }
});
