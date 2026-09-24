// Run with Playwright installed: node tests/browser-smoke.cjs
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const projectRoot = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const assets = new Map([...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)]
    .map(([, filename]) => ['/' + filename, filename]));
(async () => {
    const browser = await chromium.launch({headless: true, ...(process.env.CHROME_EXECUTABLE ? {executablePath: process.env.CHROME_EXECUTABLE} : {})});
    try {
        const page = await browser.newPage({viewport: {width: 1280, height: 900}});
        const errors = [];
        const failedRequests = [];
        page.on('requestfailed', request => failedRequests.push(request.url()));
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            if (route.request().url().includes('cdn.jsdelivr.net')) return route.fulfill({contentType: 'application/javascript', body: 'window.supabase = {createClient: () => ({auth: {getSession: async () => ({data: {session: null}}), onAuthStateChange: () => {}}})};'});
            if (route.request().url() === 'http://127.0.0.1/pvz-test') return route.fulfill({contentType: 'text/html', body: html});
            const url = new URL(route.request().url());
            const filename = url.origin === 'http://127.0.0.1' && assets.get(url.pathname);
            if (filename) return route.fulfill({
                contentType: filename.endsWith('.css') ? 'text/css' : 'application/javascript',
                body: fs.readFileSync(path.join(projectRoot, filename), 'utf8')
            });
            return route.abort();
        });
        await page.goto('http://127.0.0.1/pvz-test');
        await page.evaluate(() => {
            currentUser = {id: 'test'};
            profile = {username: 'BrowserTest', unlocked_level: 10};
            chooseLevel(3);
        });
        await page.locator('.plant').filter({hasText: 'Горохострел'}).click();
        await page.locator('.plant').filter({hasText: 'Подсолнух'}).click();
        await page.getByRole('button', {name: '🎮 НАЧАТЬ УРОВЕНЬ'}).click();
        await page.getByRole('button', {name: '🌻 50'}).click();
        const lawn = page.locator('#lawn');
        const box = await lawn.boundingBox();
        await page.mouse.click(box.x + box.width * .25, box.y + box.height * .25);
        assert.equal(await page.locator('.plant-on-board').count(), 1);
        assert.equal(await page.locator('.plant-on-board').textContent(), '🌻');
        assert.equal(await page.locator('#sunCount').textContent(), '100');
        await page.getByRole('button', {name: '🌱 100'}).click();
        await page.mouse.click(box.x + box.width * .35, box.y + box.height * .25);
        assert.equal(await page.locator('.plant-on-board').count(), 2);
        assert.equal(await page.locator('#sunCount').textContent(), '0');
        await page.getByRole('button', {name: '🪣 Лопата'}).click();
        await page.locator('.plant-on-board').first().click();
        assert.equal(await page.locator('.plant-on-board').count(), 1);
        assert.deepEqual(errors, []);
        assert.deepEqual(failedRequests, [], 'all application assets must load');
        if (process.env.PVZ_SCREENSHOT) await page.screenshot({path: process.env.PVZ_SCREENSHOT});
        console.log('Browser smoke passed: selection, real grid clicks, planting, sun cost, shovel; no page errors.');
    } finally {
        await browser.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
