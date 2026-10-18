// Run with Playwright installed: node tests/browser-smoke.cjs
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const projectRoot = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const assets = new Map([...html.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)(?:\?[^"]*)?"/g)]
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
        await page.locator('.plant').filter({hasText: 'Подсолнух'}).first().click();
        await page.getByRole('button', {name: '🎮 НАЧАТЬ УРОВЕНЬ'}).click();
        await page.evaluate(() => { sun = 150; updateSun(); });
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
        await page.evaluate(() => {
            stopGame();
            profile.unlocked_level = 50;
            currentLevel = 41;
            createBoard();
            boardPlants = [{id:'melon',plantId:'wintermelon',row:1,col:1,health:100}];
            boardPlants.forEach(renderBoardPlant);
            zombies = [{id:'target',row:1,x:70,hp:300,speed:1}];
            zombies.forEach(renderZombie);
            updatePlants();
        });
        assert.equal(await page.locator('.terrain-4').count(), 1);
        assert.equal(await page.locator('.shot-wintermelon').textContent(), '🍈');
        await page.evaluate(() => {
            boardPlants = []; zombies = []; createBoard();
            gameRunning = true; endingGame = false; shovelMode = false;
            activePlantId = 'peashooter'; selectedPlants = ['peashooter']; sun = 10000;
        });
        const gridBox = await lawn.boundingBox();
        const controlsBox = await page.locator('.game-controls').boundingBox();
        assert.ok(controlsBox.y+controlsBox.height <= gridBox.y, 'controls must not overlap planting grid');
        for (let row=0; row<5; row++) {
            for (let col=0; col<10; col++) {
                const cell = page.locator(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
                const bounds = await cell.boundingBox();
                await page.mouse.click(bounds.x+bounds.width*.5, bounds.y+bounds.height*.5);
                assert.equal(await page.evaluate(({row,col}) => boardPlants.some(p=>p.row===row && p.col===col), {row,col}), true, `roof planting row ${row}, col ${col}`);
            }
        }
        assert.equal(await page.locator('.plant-on-board').count(),50);
        assert.deepEqual(errors, []);
        if (process.env.PVZ_SCREENSHOT) await page.screenshot({path: process.env.PVZ_SCREENSHOT});
        await page.evaluate(() => { stopGame(); profile.unlocked_level=1; showMenu(); });
        await page.getByRole('button', {name:'🏖️ Играть', exact:true}).click();
        assert.equal(await page.locator('#sandboxMaps button').count(),5);
        await page.locator('#sandboxMaps button').nth(4).click();
        await page.evaluate(() => stopGame());
        assert.equal(await page.locator('#myPlantList button').count(),50);
        assert.equal(await page.locator('#sunCount').textContent(),'∞');
        assert.equal(await page.locator('.terrain-4').count(),1);
        await page.evaluate(() => { gameRunning=true; sun=0; });
        await page.locator('#myPlantList button').last().click();
        const roofCell = await page.locator('.grid-cell[data-row="2"][data-col="4"]').boundingBox();
        await page.mouse.click(roofCell.x+roofCell.width/2,roofCell.y+roofCell.height/2);
        assert.equal(await page.evaluate(()=>boardPlants[0]?.plantId),'primalwallnut');
        assert.equal(await page.locator('#sunCount').textContent(),'∞');
        await page.locator('#sandboxZombies button').nth(2).click();
        assert.equal(await page.evaluate(()=>zombies.some(z=>z.emoji.includes('🪣'))),true);
        assert.deepEqual(errors, []);
        if(process.env.PVZ_SCREENSHOT) await page.screenshot({path:process.env.PVZ_SCREENSHOT});
        console.log('Browser smoke passed: selection, real grid clicks, planting, sun cost, shovel; no page errors.');
    } finally {
        await browser.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
