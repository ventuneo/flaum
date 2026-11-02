// End-to-end checks of the real flows in a phone-sized browser, with a controlled clock.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium, webkit } from 'playwright';

const ENGINE = process.env.ENGINE ?? 'chrome';
const PORT = 4800 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}/`;
const NOW = new Date('2026-11-03T15:00:00+01:00');
let server;
let browser;

before(async () => {
  server = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 400));
  browser = ENGINE === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
});
after(async () => {
  await browser?.close();
  server?.kill();
});

async function open({ blockSw = true, viewport = { width: 390, height: 844 }, scheme = 'light', clock = true } = {}) {
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
    colorScheme: scheme,
    serviceWorkers: blockSw ? 'block' : 'allow',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (clock) await page.clock.install({ time: NOW });
  await page.goto(BASE);
  return { page, context, errors };
}

const button = (page, name) => page.getByRole('button', { name, exact: true });
const link = (page, name) => page.getByRole('link', { name, exact: true });
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('flaum.v1')));
const word = (page) => page.locator('.word').first();
// The installed clock keeps ticking in real time between steps, so durations are compared with a margin.
const near = (actual, expected, margin = 3000) => assert.ok(Math.abs(actual - expected) <= margin, `${actual} is not close to ${expected}`);

async function setupBaby(page, birth = '2026-06-01') {
  await button(page, 'Unser Baby ist da').click();
  await button(page, 'Weiter').click();
  await page.locator('input[data-bind="name"]').fill('Mia');
  await page.locator('input[data-bind="date"]').fill(birth);
  await button(page, 'Mädchen').click();
  await button(page, 'Weiter').click();
  await button(page, 'Fertig').click();
  await page.waitForFunction(() => location.hash === '#/heute');
}

async function setupPregnancy(page, due = '2026-11-28') {
  await button(page, 'Ich bin schwanger').click();
  await button(page, 'Weiter').click();
  await page.locator('input[data-bind="date"]').fill(due);
  await button(page, 'Fertig').click();
  await page.waitForFunction(() => location.hash === '#/heute');
}

test('onboarding asks for no account and validates the date', async () => {
  const { page, errors } = await open();
  await button(page, 'Weiter').click();
  await page.getByText('Wähle eine der beiden Möglichkeiten.').waitFor();
  await button(page, 'Ich bin schwanger').click();
  await button(page, 'Weiter').click();
  await button(page, 'Fertig').click();
  await page.getByText('Trag den errechneten Termin ein.').waitFor();
  await page.locator('input[data-bind="date"]').fill('2029-01-01');
  await button(page, 'Fertig').click();
  await page.getByText(/mehr als 40 Wochen/).waitFor();
  await page.locator('input[data-bind="date"]').fill('2026-11-28');
  await button(page, 'Fertig').click();
  await page.getByRole('heading', { name: '36+3' }).waitFor();
  await page.getByText('Noch 25 Tage bis zum Termin').waitFor();
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('contraction timer: one tap to start, one to stop, seconds, intensity, undo', async () => {
  const { page, errors } = await open();
  await setupPregnancy(page);
  await page.getByRole('link', { name: /^Wehen/ }).click();
  await page.locator('.breath').click();
  await page.clock.fastForward(52_000);
  await page.locator('.breath .word').filter({ hasText: '00:52' }).waitFor();
  await page.locator('.breath').click();
  await page.getByText('Wehe gespeichert: 52 Sek').waitFor();
  await button(page, 'Stark').click();
  let s = await state(page);
  assert.equal(s.entries[0].data.intensity, 'strong');
  near(s.entries[0].end - s.entries[0].start, 52_000);
  await button(page, 'Rückgängig').click();
  s = await state(page);
  assert.ok(s.entries[0].deletedAt, 'entry removed');
  assert.equal(s.timers.length, 1, 'timer is back');
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('contraction call hint appears only for a regular pattern and shows the number', async () => {
  const { page } = await open();
  await setupPregnancy(page);
  await page.goto(`${BASE}#/einstellungen`);
  await page.locator('input[data-setting="phoneLabel"]').fill('Hebamme Anna');
  await page.locator('input[data-setting="phone"]').fill('044 123 45 67');
  await page.locator('input[data-setting="phone"]').blur();
  await page.goto(`${BASE}#/wehen`);
  assert.equal(await page.locator('a[href="tel:0441234567"]').count(), 1);
  await page.getByText('Hebamme Anna anrufen').waitFor();
  assert.equal(await page.locator('.callout').count(), 0);
  for (let i = 0; i < 6; i += 1) {
    await page.locator('.breath').click();
    await page.clock.fastForward(60_000);
    await page.locator('.breath').click();
    await page.clock.fastForward(4 * 60_000 + 30_000);
  }
  await page.locator('.breath').click();
  await page.clock.fastForward(60_000);
  await page.locator('.breath').click();
  await page.locator('.callout').getByText(/Ruf jetzt dein Spital oder deine Hebamme an/).waitFor();
  await page.context().close();
});

test('emergency advice stays available in the contraction screen', async () => {
  const { page } = await open();
  await setupPregnancy(page);
  await page.goto(`${BASE}#/wehen`);
  await page.getByText('Wann soll ich anrufen?').click();
  await page.getByText(/Fruchtwasserabgang, Blutung/).waitFor();
  assert.equal(await page.locator('a[href="tel:144"]').count(), 1);
  await page.context().close();
});

test('the birth button moves a pregnancy to the baby phase and keeps the due date', async () => {
  const { page, errors } = await open();
  await setupPregnancy(page);
  await page.getByRole('link', { name: /^Baby ist da/ }).click();
  await page.locator('input[data-bind="name"]').fill('Noah');
  await page.locator('input[data-bind="birthDate"]').fill('2026-11-02');
  await button(page, 'Speichern').click();
  await page.getByRole('link', { name: /^Schlaf/ }).waitFor();
  const s = await state(page);
  assert.equal(s.children[0].phase, 'born');
  assert.equal(s.children[0].dueDate, '2026-11-28');
  assert.equal(s.children[0].birthDate, '2026-11-02');
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('a running sleep timer survives closing the app', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.getByRole('link', { name: /^Schlaf/ }).click();
  await button(page, 'Schlaf starten').click();
  await page.getByText('Schläft seit 15:00').waitFor();
  await page.clock.fastForward(30 * 60_000);
  await page.reload();
  await page.clock.fastForward(1000);
  await page.locator('.word--clock').filter({ hasText: '30:' }).waitFor();
  await page.context().close();
});

test('short wakings stop the sleep clock without ending the sleep', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/log/sleep`);
  await button(page, 'Schlaf starten').click();
  await page.waitForFunction(() => location.hash === '#/heute');
  await page.clock.fastForward(60 * 60_000);
  await page.goto(`${BASE}#/log/sleep`);
  await button(page, 'Kurz wach').click();
  await page.clock.fastForward(20 * 60_000);
  await button(page, 'Schläft wieder').click();
  await page.getByText('1-mal kurz wach').waitFor();
  await page.clock.fastForward(40 * 60_000);
  await button(page, 'Aufgewacht').click();
  await page.getByText('Schlaf gespeichert: 1 Std 40 Min').waitFor();
  const s = await state(page);
  assert.equal(s.entries[0].data.wakes.length, 1);
  await page.context().close();
});

test('undo after stopping brings the sleep timer back', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/log/sleep`);
  await button(page, 'Schlaf starten').click();
  await page.clock.fastForward(10 * 60_000);
  await page.goto(`${BASE}#/log/sleep`);
  await button(page, 'Aufgewacht').click();
  await button(page, 'Rückgängig').click();
  const s = await state(page);
  assert.equal(s.timers.length, 1);
  assert.ok(s.entries[0].deletedAt);
  await page.getByText(/Schläft seit/).waitFor();
  await page.context().close();
});

test('an accidentally ended nap can keep running from its entry', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/log/sleep`);
  await button(page, 'Schlaf starten').click();
  await page.clock.fastForward(10 * 60_000);
  await page.goto(`${BASE}#/log/sleep`);
  await button(page, 'Aufgewacht').click();
  await page.waitForFunction(() => location.hash === '#/heute');
  const id = (await state(page)).entries[0].id;
  await page.goto(`${BASE}#/eintrag/${id}`);
  await button(page, 'Aus Versehen beendet? Weiterlaufen lassen').click();
  const s = await state(page);
  assert.equal(s.timers.length, 1);
  assert.equal(s.timers[0].start, s.entries[0].start);
  await page.context().close();
});

test('nursing switches sides, remembers the last side and saves both', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/log/nursing`);
  await page.locator('button.side').first().click();
  await page.clock.fastForward(5 * 60_000);
  await page.locator('button.side').nth(1).click();
  await page.clock.fastForward(3 * 60_000);
  await button(page, 'Speichern').click();
  await page.getByText('Stillen gespeichert: 8 Min').waitFor();
  const s = await state(page);
  near(s.entries[0].data.left, 5 * 60_000);
  near(s.entries[0].data.right, 3 * 60_000);
  assert.equal(s.entries[0].data.lastSide, 'right');
  await page.goto(`${BASE}#/log/nursing`);
  await page.locator('button.side').nth(1).getByText('Zuletzt hier').waitFor();
  await page.context().close();
});

test('every entry confirms what was saved, can be undone and edited', async () => {
  const { page, errors } = await open();
  await setupBaby(page);
  await page.getByRole('link', { name: /^Flasche/ }).click();
  await button(page, '150 ml').click();
  await button(page, 'Pre-Milch').click();
  await button(page, 'Speichern').click();
  await page.getByText('Flasche gespeichert: 150 ml').waitFor();
  let s = await state(page);
  assert.deepEqual(s.entries[0].data, { ml: 150, kind: 'formula' });
  await button(page, 'Rückgängig').click();
  s = await state(page);
  assert.ok(s.entries[0].deletedAt);

  await page.goto(`${BASE}#/log/diaper`);
  await button(page, 'Voll').click();
  await button(page, 'Mehr Details').click();
  await button(page, 'Grün').click();
  await button(page, 'Speichern').click();
  await page.goto(`${BASE}#/verlauf`);
  await button(page, 'Liste').click();
  await page.getByRole('link', { name: /Windel/ }).click();
  await button(page, 'Beides').click();
  await button(page, 'Speichern').click();
  await page.getByText('Windel gespeichert: Beides').waitFor();
  s = await state(page);
  const diaper = s.entries.find((e) => e.type === 'diaper');
  assert.equal(diaper.data.kind, 'both');
  assert.equal(diaper.data.color, 'gruen');
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('time can be typed directly, and a future time is rejected with a clear message', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/log/diaper`);
  await page.getByRole('button', { name: /Wann/ }).click();
  await page.getByLabel('Stunde').fill('9');
  await page.getByLabel('Stunde').blur();
  await page.getByLabel('Minute').fill('41');
  await page.getByLabel('Minute').blur();
  await button(page, 'Speichern').click();
  let s = await state(page);
  const d = new Date(s.entries[0].start);
  assert.equal(`${d.getHours()}:${d.getMinutes()}`, '9:41');

  await page.goto(`${BASE}#/log/diaper`);
  await page.getByRole('button', { name: /Wann/ }).click();
  await page.getByLabel('Stunde').fill('23');
  await page.getByLabel('Stunde').blur();
  await button(page, 'Speichern').click();
  await page.getByText('Der Beginn liegt in der Zukunft. Wähle eine frühere Zeit.').waitFor();
  s = await state(page);
  assert.equal(s.entries.length, 1);
  await page.context().close();
});

test('solids can be logged without details, and foods added later', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/log/solids`);
  await button(page, 'Speichern').click();
  await page.getByText('Beikost gespeichert').waitFor();
  const id = (await state(page)).entries[0].id;
  await page.goto(`${BASE}#/eintrag/${id}`);
  await page.locator('input[data-food-search]').fill('trau');
  await page.getByRole('button', { name: 'Trauben' }).click();
  await page.getByText(/längs vierteln/).waitFor();
  await page.locator('input[data-food-search]').fill('Griessbrei');
  await page.getByRole('button', { name: '«Griessbrei» hinzufügen' }).click();
  await button(page, 'Speichern').click();
  await page.waitForFunction(() => location.hash !== '' && !location.hash.startsWith('#/eintrag'));
  const s = await state(page);
  assert.deepEqual(s.entries[0].data.foods, ['Trauben', 'Griessbrei']);
  await page.context().close();
});

test('a sleep across midnight is listed once and counted on both days', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/log/sleep`);
  await button(page, 'Schon vorbei? Zeiten eintragen').click();
  await page.getByRole('button', { name: /Eingeschlafen/ }).click();
  await page.locator('input[data-time="day"]').fill('2026-11-02');
  await page.locator('input[data-time="day"]').blur();
  await page.getByLabel('Stunde').fill('22');
  await page.getByLabel('Stunde').blur();
  await page.getByLabel('Minute').fill('00');
  await page.getByLabel('Minute').blur();
  await page.getByRole('button', { name: /Eingeschlafen/ }).click();
  await page.getByRole('button', { name: /Aufgewacht/ }).click();
  await page.getByLabel('Stunde').fill('6');
  await page.getByLabel('Stunde').blur();
  await page.getByLabel('Minute').fill('00');
  await page.getByLabel('Minute').blur();
  await button(page, 'Speichern').click();
  await page.getByText('Schlaf gespeichert: 8 Std').waitFor();
  await page.goto(`${BASE}#/verlauf`);
  await button(page, 'Tag').click();
  await page.locator('.facts').getByText('6 Std').waitFor();
  assert.equal(await page.locator('.rows .row').count(), 0, 'not listed on the second day');
  await page.getByRole('button', { name: 'Zurück', exact: true }).last().click();
  await page.locator('.facts').getByText('2 Std').waitFor();
  assert.equal(await page.locator('.rows .row').count(), 1, 'listed once, on the day it began');
  await button(page, 'Liste').click();
  assert.equal(await page.locator('.rows .row').count(), 1);
  await page.context().close();
});

test('the week view opens a day, and every mark in the day opens its entry', async () => {
  const { page, errors } = await open();
  await button(page, 'Mit Beispieldaten ansehen').click();
  await page.goto(`${BASE}#/verlauf`);
  await button(page, 'Woche').click();
  await page.locator('[data-act="open-day"]').first().click();
  await page.locator('.pager h2').filter({ hasText: 'Gestern' }).waitFor();
  await page.locator('[data-act="open-entry"]').first().click();
  await page.waitForFunction(() => location.hash.startsWith('#/eintrag/'));
  await page.getByRole('button', { name: 'Schliessen' }).click();
  await page.waitForFunction(() => location.hash === '#/verlauf');
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('notes are readable in the list without opening the entry', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/log/diaper`);
  await button(page, 'Mehr Details').click();
  await button(page, 'Notiz hinzufügen').click();
  await page.locator('textarea').fill('Etwas wund');
  await button(page, 'Speichern').click();
  await page.goto(`${BASE}#/verlauf`);
  await button(page, 'Liste').click();
  await page.locator('.row-note').getByText('Etwas wund').waitFor();
  await page.context().close();
});

test('trends select a day and offer a table', async () => {
  const { page, errors } = await open();
  await button(page, 'Mit Beispieldaten ansehen').click();
  await page.goto(`${BASE}#/verlauf`);
  await button(page, 'Trends').click();
  await page.getByText(/Im Schnitt pro Tag/).waitFor();
  await page.locator('[data-act="select-bar"]').nth(2).click();
  assert.equal(await page.getByText(/Im Schnitt pro Tag/).count(), 0);
  await page.getByRole('button', { name: 'Als Tabelle anzeigen' }).click();
  assert.equal(await page.locator('table tbody tr').count(), 7);
  await button(page, 'Wachstum').click();
  await page.locator('.headline').filter({ hasText: 'kg' }).waitFor();
  await page.getByText(/Perzentile/).first().waitFor();
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('sleep hints start at eight weeks and can be switched off', async () => {
  const { page } = await open();
  await setupBaby(page, '2026-10-01');
  await page.goto(`${BASE}#/log/sleep`);
  await button(page, 'Schon vorbei? Zeiten eintragen').click();
  await button(page, 'Speichern').click();
  await page.waitForFunction(() => location.hash === '#/heute');
  assert.equal(await page.locator('.hint').count(), 0, 'no hint for a young baby');
  await page.goto(`${BASE}#/tagesplan`);
  await page.getByText(/ersten acht Wochen/).waitFor();

  const older = await open();
  await setupBaby(older.page, '2026-06-01');
  await older.page.goto(`${BASE}#/log/sleep`);
  await button(older.page, 'Schon vorbei? Zeiten eintragen').click();
  await button(older.page, 'Speichern').click();
  await older.page.waitForFunction(() => location.hash === '#/heute');
  await older.page.locator('.hint').filter({ hasText: 'Nächster Schlaf etwa' }).waitFor();
  await older.page.goto(`${BASE}#/einstellungen`);
  await button(older.page, 'Hinweise anzeigen').click();
  await older.page.goto(`${BASE}#/heute`);
  assert.equal(await older.page.locator('.hint').count(), 0);
  await page.context().close();
  await older.page.context().close();
});

test('the day plan lets the person move the times', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/log/sleep`);
  await button(page, 'Schon vorbei? Zeiten eintragen').click();
  await button(page, 'Speichern').click();
  await page.goto(`${BASE}#/tagesplan`);
  const before = await word(page).textContent();
  await page.getByRole('button', { name: '15 Minuten später' }).click();
  await page.getByText('15 Min später').waitFor();
  const moved = await word(page).textContent();
  assert.notEqual(before, moved);
  await page.context().close();
});

test('quick entry shows what it understood before saving', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/mehr`);
  await page.locator('input[data-quick]').fill('heute war schön');
  await page.getByText(/Das verstehe ich noch nicht/).waitFor();
  assert.equal(await button(page, 'Speichern').count(), 0);
  await page.locator('input[data-quick]').fill('Schoppen 120 ml Pre vor 20 Min');
  await page.locator('#quick-preview').getByText(/120 ml Pre-Milch/).waitFor();
  await button(page, 'Speichern').click();
  await page.getByText('Flasche gespeichert: 120 ml').waitFor();
  const s = await state(page);
  near(s.entries[0].start, NOW.getTime() - 20 * 60_000);
  await page.context().close();
});

test('backup round trip and merging a partner file', async () => {
  const a = await open();
  await setupBaby(a.page);
  await a.page.goto(`${BASE}#/log/diaper`);
  await button(a.page, 'Speichern').click();
  await a.page.goto(`${BASE}#/einstellungen`);
  const [download] = await Promise.all([a.page.waitForEvent('download'), button(a.page, 'Daten sichern').click()]);
  assert.match(download.suggestedFilename(), /^flaum-sicherung-2026-11-03\.json$/);
  const path = await download.path();

  const b = await open();
  await setupBaby(b.page);
  await b.page.goto(`${BASE}#/log/bottle`);
  await button(b.page, 'Speichern').click();
  await b.page.goto(`${BASE}#/einstellungen`);
  await b.page.locator('input[data-import]').setInputFiles(path);
  await b.page.getByText('Datei eingelesen: 1 neu, 0 aktualisiert').waitFor();
  const s = await state(b.page);
  assert.equal(s.children.filter((c) => !c.deletedAt).length, 1, 'same child, not two');
  assert.deepEqual(s.entries.map((e) => e.type).sort(), ['bottle', 'diaper']);
  assert.equal(new Set(s.entries.map((e) => e.childId)).size, 1);

  await b.page.locator('input[data-import]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
  await b.page.getByText(/keine Flaum-Sicherung/).waitFor();
  await a.page.context().close();
  await b.page.context().close();
});

test('text from a file or input never becomes code', async () => {
  const { page, errors } = await open();
  await setupBaby(page);
  const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
  await page.goto(`${BASE}#/kind/neu`);
  await page.locator('input[data-bind="name"]').fill(evil);
  await page.locator('input[data-bind="birthDate"]').fill('2026-06-01');
  await button(page, 'Speichern').click();
  await page.goto(`${BASE}#/log/medicine`);
  await page.locator('input[data-bind="name"]').fill(evil);
  await button(page, 'Notiz hinzufügen').click();
  await page.locator('textarea').fill(evil);
  await button(page, 'Speichern').click();
  for (const hash of ['#/heute', '#/verlauf', '#/bericht', '#/einstellungen', '#/kinder']) {
    await page.goto(`${BASE}${hash}`);
    await page.waitForTimeout(50);
  }
  await page.goto(`${BASE}#/verlauf`);
  await button(page, 'Liste').click();
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  assert.equal(await page.locator('#root img').count(), 0);
  assert.deepEqual(errors.filter((e) => !e.includes('Content Security Policy')), []);
  await page.context().close();
});

test('a damaged save does not lock anyone out', async () => {
  const { page, errors } = await open();
  await page.evaluate(() => localStorage.setItem('flaum.v1', '{kaputt'));
  await page.reload();
  await button(page, 'Ich bin schwanger').waitFor();
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('deleting everything asks first and returns to the start', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/einstellungen`);
  await button(page, 'Alle Daten löschen').click();
  await button(page, 'Abbrechen').click();
  assert.equal((await state(page)).children.length, 1);
  await button(page, 'Alle Daten löschen').click();
  await button(page, 'Ja, alles löschen').click();
  await button(page, 'Ich bin schwanger').waitFor();
  assert.equal((await state(page)).children.length, 0);
  await page.context().close();
});

test('reminders fire once while the app is open and export a calendar file', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.goto(`${BASE}#/erinnerungen`);
  await page.locator('input[data-bind="title"]').fill('Vitamin D');
  await page.locator('input[data-bind="time"]').fill('15:10');
  await button(page, 'Erinnerung speichern').click();
  await page.getByText('Täglich um 15:10').waitFor();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Vitamin D in den Kalender übernehmen' }).click(),
  ]);
  const ics = await readFile(await download.path(), 'utf8');
  assert.match(ics, /RRULE:FREQ=DAILY/);
  assert.match(ics, /SUMMARY:Vitamin D/);
  await page.clock.fastForward(11 * 60_000);
  await page.getByText('Erinnerung: Vitamin D').waitFor();
  await page.context().close();
});

test('back and close return to the previous screen and never leave the app', async () => {
  const { page } = await open();
  await setupBaby(page);
  await page.getByRole('link', { name: 'Mehr festhalten' }).click();
  await page.getByRole('link', { name: 'Wachstum' }).click();
  await page.getByRole('button', { name: 'Schliessen' }).click();
  await page.waitForFunction(() => location.hash === '#/mehr');
  await page.getByRole('link', { name: 'Zurück' }).click();
  await page.waitForFunction(() => location.hash === '#/heute');

  // A deep link from a home screen shortcut has no history behind it.
  await page.goto('about:blank');
  await page.goto(`${BASE}#/log/bottle`);
  await page.getByRole('button', { name: 'Schliessen' }).click();
  await page.waitForFunction(() => location.hash === '#/heute');
  await page.context().close();
});

test('no outside requests: everything comes from the app itself', async () => {
  const { page, context } = await open({ clock: false });
  const outside = [];
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) outside.push(r.url()); });
  await button(page, 'Mit Beispieldaten ansehen').click();
  for (const hash of ['#/heute', '#/verlauf', '#/log/bottle', '#/einstellungen', '#/bericht', '#/tagesplan']) {
    await page.goto(`${BASE}${hash}`);
    await page.waitForTimeout(40);
  }
  assert.deepEqual(outside, []);
  await context.close();
});

test('works offline after the first visit, saved data included', { skip: ENGINE === 'webkit' }, async () => {
  const { page, context, errors } = await open({ blockSw: false, clock: false });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await setupBaby(page);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('link', { name: /^Schlaf/ }).waitFor();
  await page.goto(`${BASE}#/log/diaper`);
  await button(page, 'Speichern').click();
  await page.getByText('Windel gespeichert: Nass').waitFor();
  assert.equal((await state(page)).entries.length, 1);
  await context.setOffline(false);
  assert.deepEqual(errors.filter((e) => !/net::|Failed to fetch/.test(e)), []);
  await context.close();
});

test('the most used screens fit a small phone without scrolling to the main action', async () => {
  const { page } = await open({ viewport: { width: 375, height: 667 } });
  await button(page, 'Mit Beispieldaten ansehen').click();
  await page.waitForFunction(() => location.hash === '#/heute');
  const inView = async (locator) => {
    await page.waitForTimeout(450); // let the sheet finish rising
    const box = await locator.boundingBox();
    return box && box.y >= 0 && box.y + box.height <= 667;
  };
  assert.ok(await inView(page.locator('.pillnav')), 'navigation on Heute');
  await page.goto(`${BASE}#/log/diaper`);
  assert.ok(await inView(button(page, 'Speichern')), 'save on diaper');
  await page.goto(`${BASE}#/kinder`);
  await button(page, 'Bauchzwerg').click();
  await page.waitForFunction(() => location.hash === '#/heute');
  assert.ok(await inView(page.locator('.pillnav')), 'navigation in pregnancy');
  await page.context().close();
});

test('interactive elements are large enough for tired thumbs', async () => {
  const { page } = await open();
  await button(page, 'Mit Beispieldaten ansehen').click();
  await page.waitForFunction(() => location.hash === '#/heute');
  for (const hash of ['#/heute', '#/log/bottle', '#/log/diaper', '#/log/nursing', '#/verlauf']) {
    await page.goto(`${BASE}${hash}`);
    await page.waitForTimeout(40);
    const small = await page.evaluate(() => [...document.querySelectorAll('#root .chip, #root .go, #root .glass, #root .tile, #root .round, #root .side')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map((el) => el.textContent.trim().slice(0, 20)));
    assert.deepEqual(small, [], `on ${hash}`);
  }
  await page.context().close();
});
