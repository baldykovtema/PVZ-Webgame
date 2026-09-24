// Real Supabase Realtime transport, isolated REST fixtures; no accounts or database rows are created.
// Requires Playwright and network access. PVZ_SUPABASE_BUNDLE can point to a local copy of the CDN script.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const assets = new Map([...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map(([, name]) => ['/' + name, name]));
const tables = {lobbies: [], lobby_players: []};
const users = [{id: randomUUID(), username: 'TestHost'}, {id: randomUUID(), username: 'TestGuest'}];

async function mockDatabase(route) {
    const request = route.request(), url = new URL(request.url());
    const name = url.pathname.split('/').at(-1);
    if (!tables[name]) throw new Error('Unexpected database request: ' + name);
    const matches = row => [...url.searchParams].every(([key, filter]) => {
        if (filter.startsWith('eq.')) return String(row[key]) === filter.slice(3);
        if (filter.startsWith('in.(')) return filter.slice(4,-1).split(',').includes(String(row[key]));
        return true;
    });
    let rows = tables[name].filter(matches);
    if (request.method() === 'POST') {
        const row = {id: randomUUID(), created_at: new Date().toISOString(), joined_at: new Date().toISOString(), ...request.postDataJSON()};
        tables[name].push(row); rows = [row];
    }
    if (request.method() === 'PATCH') rows.forEach(row => Object.assign(row, request.postDataJSON()));
    if (request.method() === 'DELETE') tables[name] = tables[name].filter(row => !matches(row));
    const single = request.headers().accept?.includes('vnd.pgrst.object');
    return route.fulfill({status: 200, contentType: 'application/json',
        headers: {'content-range': rows.length ? `0-${rows.length-1}/${rows.length}` : '*/0'},
        body: request.method() === 'HEAD' ? '' : JSON.stringify(single ? rows[0] ?? null : rows)});
}

(async () => {
    const browser = await chromium.launch({headless: true, ...(process.env.CHROME_EXECUTABLE ? {executablePath: process.env.CHROME_EXECUTABLE} : {})});
    const errors = [], dialogs = [];
    try {
        const pages = [];
        for (const user of users) {
            const context = await browser.newContext({viewport: {width: 1440, height: 900}});
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.pathname.startsWith('/rest/v1/')) return mockDatabase(route);
                if (url.hostname === 'cdn.jsdelivr.net' && process.env.PVZ_SUPABASE_BUNDLE) return route.fulfill({contentType: 'application/javascript', body: fs.readFileSync(process.env.PVZ_SUPABASE_BUNDLE, 'utf8')});
                if (url.origin !== 'http://127.0.0.1') return route.continue();
                if (url.pathname === '/pvz-test') return route.fulfill({contentType:'text/html', body:html});
                const file = assets.get(url.pathname);
                if (file) return route.fulfill({contentType:file.endsWith('.css') ? 'text/css' : 'application/javascript', body:fs.readFileSync(path.join(root,file),'utf8')});
                return route.abort();
            });
            await page.goto('http://127.0.0.1/pvz-test');
            await page.waitForFunction(() => document.getElementById('authScreen').classList.contains('active'));
            await page.evaluate(user => { currentUser = {id:user.id}; profile = {...user, unlocked_level:30}; }, user);
            pages.push(page);
        }
        const [host, guest] = pages;
        await host.evaluate(() => showOnline());
        await host.getByRole('button', {name:'＋ Создать лобби'}).first().click();
        await host.locator('#lobbyScreen.active').waitFor();
        await guest.evaluate(() => showOnline());
        await guest.getByRole('button', {name:'👥 Войти в лобби'}).click();
        await guest.locator('#lobbyScreen.active').waitFor();
        await host.waitForFunction(() => document.getElementById('lobbyInfo').textContent.includes('2 / 4'));
        await host.locator('#readyButton').click();
        await guest.locator('#readyButton').click();
        await Promise.all(pages.map(page => page.locator('#gameScreen.active').waitFor({timeout:40000})));
        await guest.getByRole('button', {name:'🌻 50'}).click();
        const box = await guest.locator('#lawn').boundingBox();
        await guest.mouse.click(box.x + box.width * .25, box.y + box.height * .25);
        await host.waitForFunction(() => boardPlants.length === 1);
        await guest.waitForFunction(() => boardPlants.length === 1);
        assert.equal(await host.evaluate(() => boardPlants[0].owner), 'TestGuest');
        assert.equal(await guest.evaluate(() => gameTimer), null);
        assert.equal(await host.evaluate(() => sun), await guest.evaluate(() => sun));
        await host.evaluate(() => spawnSun());
        await guest.locator('.sun').first().click();
        await host.waitForFunction(() => sun >= 125);
        await guest.waitForFunction(() => sun >= 125);
        await host.locator('#exitGameButton').click();
        await Promise.all(pages.map(page => page.locator('#onlineScreen.active').waitFor()));
        assert.equal(tables.lobby_players.length, 0);
        assert.deepEqual(errors, []);
        assert.ok(!dialogs.some(message => message.includes('❌')), dialogs.join('\n'));
        console.log('Live online smoke passed: create/join lobby, ready, real Realtime start, guest planting, shared sun, exit for both players.');
    } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
