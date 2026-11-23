import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('directory, profile, org chart, shared hours, skills', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-23T11:00:00Z'));
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Who’s who');
  await expect(page.locator('.hero .pcard').first()).toBeVisible();
  await page.waitForTimeout(1000);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');

  await page.getByRole('link', { name: 'Browse the team' }).click();
  await page.getByRole('button', { name: 'Working now' }).click();
  await expect(page.getByTestId('count')).toHaveText('4 shown');
  await page.getByRole('button', { name: 'Working now' }).click();
  await snap(page, 'people');
  await checkMobile(page);

  await page.getByRole('link', { name: /Kwame Asante/ }).click();
  await expect(page.getByText(/Annual leave until/)).toBeVisible();
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Role').fill('Senior Backend Engineer');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Senior Backend Engineer')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Senior Backend Engineer')).toBeVisible();
  await snap(page, 'profile');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Org chart' }).click();
  await snap(page, 'org');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Shared hours' }).click();
  await page.getByRole('checkbox', { name: /Aiko/ }).uncheck();
  await page.getByRole('checkbox', { name: /Jamal/ }).check();
  await expect(page.getByTestId('overlap')).toContainText('Shared hours: 14:00–17:30 UTC');
  await snap(page, 'overlap');
  await checkMobile(page, 'overlap-mobile');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Skills' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await snap(page, 'skills');
});
