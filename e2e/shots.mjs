// Walks through every screen with sample data and saves screenshots for review.
// Usage: node e2e/shots.mjs [outDir] [light|dark] [width] [height] [engine]
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const OUT = process.argv[2] ?? 'e2e/shots';
const SCHEME = process.argv[3] ?? 'light';
const WIDTH = Number(process.argv[4] ?? 390);
const HEIGHT = Number(process.argv[5] ?? 844);
const ENGINE = process.argv[6] ?? 'chrome';
const PORT = 4300 + Math.floor(Math.random() * 500);

await mkdir(OUT, { recursive: true });
const server = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 400));

const browser = ENGINE === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: ENGINE !== 'webkit',
  colorScheme: SCHEME,
  locale: 'de-CH',
  timezoneId: 'Europe/Zurich',
  serviceWorkers: 'block',
});
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });

const base = `http://127.0.0.1:${PORT}/`;
const shot = async (name) => {
  await page.waitForTimeout(950);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const overflow = await page.evaluate(() => {
    const s = document.querySelector('.screen');
    return { x: s ? s.scrollWidth > s.clientWidth + 1 : false, doc: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  if (overflow.x || overflow.doc) problems.push(`horizontal overflow on ${name}`);
};
const go = async (hash) => { await page.goto(`${base}${hash}`); };

await go('');
await shot('01-start');
await page.getByRole('button', { name: 'Ich bin schwanger' }).click();
await shot('02-start-phase');
await page.getByRole('button', { name: 'Mit Beispieldaten ansehen' }).click();
await page.waitForTimeout(200);
await shot('03-home-baby');

const routes = [
  ['04-sleep', '#/log/sleep'], ['05-nursing', '#/log/nursing'], ['06-bottle', '#/log/bottle'],
  ['07-diaper', '#/log/diaper'], ['08-pump', '#/log/pump'], ['09-solids', '#/log/solids'],
  ['10-mood', '#/log/mood'], ['11-growth', '#/log/growth'], ['12-medicine', '#/log/medicine'],
  ['13-temperature', '#/log/temperature'], ['14-activity', '#/log/activity'], ['15-milestone', '#/log/milestone'],
  ['16-note', '#/log/note'], ['17-more', '#/mehr'], ['18-plan', '#/tagesplan'],
  ['19-history-day', '#/verlauf'],
];
for (const [name, hash] of routes) {
  await go(hash);
  await shot(name);
}
await page.getByRole('button', { name: 'Woche', exact: true }).click();
await shot('20-history-week');
await page.getByRole('button', { name: 'Liste', exact: true }).click();
await shot('21-history-list');
await page.getByRole('button', { name: 'Trends', exact: true }).click();
await shot('22-history-trends');
await page.getByRole('button', { name: 'Flasche', exact: true }).click();
await page.getByRole('button', { name: '14 Tage', exact: true }).click();
await shot('23-trends-bottle');
await page.getByRole('button', { name: 'Wachstum', exact: true }).click();
await shot('24-trends-growth');
await go('#/bericht');
await shot('25-report');
await go('#/einstellungen');
await shot('26-settings');
await go('#/erinnerungen');
await shot('27-reminders');

// Pregnancy phase
await go('#/kinder');
await page.getByRole('button', { name: 'Bauchzwerg' }).click();
await page.waitForTimeout(200);
await shot('28-home-pregnant');
await go('#/wehen');
await shot('29-contractions');
await page.locator('.breath').click();
await shot('30-contraction-running');
await page.locator('.breath').click();
await page.waitForTimeout(100);
await shot('31-contraction-saved');
await go('#/log/mood');
await page.getByRole('button', { name: 'Ruhig' }).click();
await shot('32-mood-calm');
await page.getByRole('button', { name: 'Fröhlich' }).click();
await shot('33-mood-happy');

await browser.close();
server.kill();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no page errors, no horizontal overflow');
