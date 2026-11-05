const path = require('node:path');
const { test, expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '../..');
const practice = require(path.join(ROOT, 'starter/ContosoDentistryFAQs/practice.json'));
const { PRACTICE_PHONE } = require(path.join(ROOT, 'starter/ContosoDentistryChatBot/src/messages.js'));

test.beforeEach(async ({ page }) => {
    // Never touch the real bot from a smoke test.
    await page.route('**/api/token', (route) => route.fulfill({ status: 503, body: '{}' }));
    await page.goto('/');
});

test('the hero loads with the practice name and primary actions', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ask Denta to book' })).toBeVisible();
    await expect(page.locator('.hero-photo img')).toHaveJSProperty('complete', true);
});

test('the page never scrolls sideways', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test('the website and the bot show the same practice facts as practice.json', async ({ page }) => {
    const text = await page.locator('body').innerText();

    expect(text).toContain(practice.phone);
    expect(text).toContain(practice.address.street);
    expect(text).toContain(practice.email);
    for (const member of practice.staff) expect(text).toContain(member.name);
    for (const review of practice.testimonials) expect(text).toContain(review.author);
    expect(PRACTICE_PHONE).toBe(practice.phone);
});

test('the chat opens, explains an outage, and closes with Escape', async ({ page }) => {
    const launcher = page.locator('.chat-launcher');
    await launcher.click();

    const panel = page.getByRole('dialog', { name: 'Denta' });
    await expect(panel).toBeVisible();
    await expect(launcher).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.getByRole('status')).toContainText(`call us on ${ practice.phone }`);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(launcher).toBeFocused();
});

test('full-page screenshot for review', async ({ page }, testInfo) => {
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(__dirname, 'screenshots', `${ testInfo.project.name }.png`), fullPage: true });
});
