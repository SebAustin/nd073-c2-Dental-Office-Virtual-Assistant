// Captures the rubric's website_bot_test.png: the live site with a real conversation in the chat panel.
// Usage (from tests/website): node capture-live.js https://<site>.azurestaticapps.net ../../screenshots
const path = require('node:path');
const { chromium } = require('@playwright/test');

const [site, outDir = path.join(__dirname, '../../screenshots')] = process.argv.slice(2);
const EXCHANGES = [
    ['What appointments are available?', 'open appointment times'],
    ["I don't have insurance. Can I still be seen?", 'no matter their insurance'],
    ['Book 10am', 'appointment is set for 10am']
];
const REPLY_TIMEOUT_MS = 30000;

async function ask(page, text, expectedReply) {
    const input = page.locator('#webchat input[type="text"], #webchat textarea').first();
    await input.fill(text);
    await input.press('Enter');
    await page.locator('#webchat').getByText(expectedReply).first().waitFor({ timeout: REPLY_TIMEOUT_MS });
    await page.waitForTimeout(1200);
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(site, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Ask Denta to book' }).click();
    await page.locator('#webchat input[type="text"], #webchat textarea').first().waitFor({ timeout: REPLY_TIMEOUT_MS });
    await page.locator('#webchat').getByText('the virtual assistant for Contoso Dentistry').first().waitFor({ timeout: REPLY_TIMEOUT_MS });

    try {
        for (const [question, reply] of EXCHANGES) await ask(page, question, reply);
    } catch (error) {
        await page.screenshot({ path: path.join(outDir, 'website_bot_test-debug.png') });
        throw error;
    }
    await page.screenshot({ path: path.join(outDir, 'website_bot_test.png') });
    await browser.close();
    console.log(`Saved ${ path.join(outDir, 'website_bot_test.png') }`);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
