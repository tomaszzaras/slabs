// Playwright smoke test: serves packages/web/dist and drives it in Chromium (desktop and phone width).
//   pnpm build && pnpm e2e            (SHOTS=docs/screenshots pnpm e2e  also saves screenshots)
// Chromium is preinstalled in the dev container; do not run `playwright install`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist');
const shots = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failures++; };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

// A new project is empty; most steps below work on the owner's house (four rooms and the band, generic names), which is the file a
// version-1 build stored: seeding it as the old single project exercises the migration as well. `blank` starts from nothing.
const HOUSE = fs.readFileSync(path.join(here, '..', '..', '..', 'fixtures', 'projects', 'v1-default.slabs.json'), 'utf8');
async function open(viewport, deviceScaleFactor = 1, { blank = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, locale: 'pl-PL' });
  if (!blank) await ctx.addInitScript((json) => { try { localStorage.setItem('slabs:project:v1', json); } catch { /* ignore */ } }, HOUSE);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  // This server is static: /api/projects answers 404 and the app must quietly fall back to browser-only saving.
  page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('/api/projects')) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('[role=tab]');
  return { ctx, page };
}
// the measurement panel: closed by default (rail on the right); open the section a step needs
const panel = async (page, key) => {
  if (key === 'dims') return; // the dimensions are the Kształt section of the page now
  const b = page.locator(`[data-rail=${key}]:visible`).first();
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  await page.waitForSelector(`[data-panel-state=overlay], [data-panel-state=pinned], [data-sheet-tab=${key}][aria-selected=true]`, { timeout: 10000 });
};
const stat = async (page, label) => page.locator('.stat', { hasText: label }).first().locator('b').innerText();

async function audit(page, label) {
  const r = await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('button, select, input:not([type=hidden]):not([type=checkbox]):not([type=file]), summary').forEach((el) => {
      if (el.getAttribute('role') === 'checkbox') return; // 24 px box with a 44 px hit area (::before)
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      if (b.height < 43.5 || b.width < 43.5) small.push(((el.id || el.textContent || el.tagName) + '').trim().slice(0, 24) + ` ${Math.round(b.width)}x${Math.round(b.height)}`);
    });
    const text = [];
    document.querySelectorAll('.pan svg text, .minimap svg text').forEach((t) => { const fs = parseFloat(getComputedStyle(t).fontSize); if (fs < 11) text.push(fs); });
    return { small, text, h1: document.querySelectorAll('h1').length, scrollX: document.documentElement.scrollWidth - window.innerWidth };
  });
  check(r.small.length === 0, `${label}: every control is at least 44 px${r.small.length ? ' (' + r.small.slice(0, 4).join(', ') + ')' : ''}`);
  check(r.text.length === 0, `${label}: drawing text is at least 11 px`);
  check(r.h1 === 1, `${label}: one h1`);
}

// ---------------- desktop
{
  const { ctx, page } = await open({ width: 1280, height: 1500 }, 2);
  check((await page.locator('[role=tab]').count()) === 6, 'six tabs: overview, four rooms and the band');
  check((await page.locator('[role=tab]').allInnerTexts()).join('|') === 'Przegląd|Pomieszczenie 1|Pomieszczenie 2|Pomieszczenie 3|Pomieszczenie 4|Opaska', 'tabs: Przegląd first, rooms, Opaska');
  check((await page.locator('#tab-przeglad').getAttribute('aria-selected')) === 'true' && (await page.locator('[data-room=przeglad] h1').innerText()) === 'Przegląd projektu', 'overview is the page that opens by default');
  check((await page.locator('[role=tab]').allInnerTexts()).every((x) => !x.includes('Wspólny rozkrój')), 'no Wspólny rozkrój tab');
  check((await page.locator('[data-measure-rail], #measure-panel, [data-rail]:visible').count()) === 0, 'overview: no measurement rail');
  for (const [id, name] of [['salon', 'Pomieszczenie 1'], ['sypialnia', 'Pomieszczenie 2'], ['lazienka-1', 'Pomieszczenie 3'], ['lazienka-2', 'Pomieszczenie 4']]) {
    await page.click(`#tab-${id}`);
    await page.waitForSelector(`[data-room=${id}] h1`);
    check((await page.locator(`[data-room=${id}] h1`).innerText()) === name, `${id}: heading`);
    await panel(page, 'starts');
    await page.locator('#measure-panel button', { hasText: 'Wszystkie punkty odniesienia' }).click();
    check((await page.locator('table tbody tr').count()) > 0, `${id}: reference table has rows`);
    check((await page.locator('.pan svg.mark').count()) === 1 && (await page.locator('.minimap svg').count()) === 1, `${id}: floor plan and the selected surface are drawn`);
    check((await page.locator('h1').count()) === 1, `${id}: exactly one h1`);
    const net0 = await stat(page, 'powierzchnia netto');
    // change a dimension: the area has to change
    const field = 'l';
    await panel(page, 'dims');
    const input = page.locator(`#p_${id}_${field}`);
    const old = await input.inputValue();
    await input.fill(String(Number(old) + 100));
    const net1 = await stat(page, 'powierzchnia netto');
    check(net0 !== net1, `${id}: net area changes with ${field} (${net0} -> ${net1})`);
    await input.fill(old);
    // shift controls move a start point
    await panel(page, 'starts');
    const row = page.locator('.shift').first();
    await row.locator('button').nth(2).click();
    check((await row.locator('input').inputValue()) === '5', `${id}: first start point shifted +5 with the step button`);
    await page.locator('.stepbar button', { hasText: 'Zeruj' }).click();
    check((await row.locator('input').inputValue()) === '0', `${id}: shifts reset`);
    // per-room cut
    await page.locator('button', { hasText: 'Przelicz tylko to pomieszczenie' }).click();
    await page.waitForSelector('.sheets svg', { timeout: 30000 });
    const plates = await stat(page, 'płyt wg propozycji cięć');
    check(Number(plates) > 0, `${id}: cut proposal has ${plates} plates`);
    if (id === 'salon') await audit(page, 'desktop salon');
    if (shots) await page.screenshot({ path: path.join(shots, `${id}.png`) });
  }
  // shared cut in the worker
  await page.click('#tab-przeglad');
  await page.waitForSelector('#calc');
  await page.click('#calc');
  await page.waitForSelector('.sheets svg', { timeout: 60000 });
  const total = Number(await stat(page, 'płyt razem'));
  check(total > 20 && total < 60, `shared cut: ${total} plates`);
  check((await page.locator('.sheets svg').count()) === total, 'shared cut: one drawing per plate');
  // tongue and groove is the default: P / W letters on the plates, the legend, plate settings
  check((await page.locator('.sheets svg text.mk-edgeletter').count()) > 0, 'tongue and groove: P / W letters on the plates');
  check((await page.getByText('P pióro, W wpust').count()) > 0, 'tongue and groove: legend under the plates');
  check((await page.locator('.stat', { hasText: 'gdyby płyty były gładkie' }).count()) === 0, 'no comparison with plain plates (removed at the owner\'s request)');
  check((await page.getByText('Płyta pokrywa na ścianie 499 × 124 cm').count()) > 0, 'plate settings: the plate covers 499 × 124 cm');
  if (shots) await page.screenshot({ path: path.join(shots, 'rozkroj.png') });
  // PDF cutting sheets: cover + one page per plate, vector, downloadable
  {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.locator('button', { hasText: 'Pobierz PDF' }).click()]);
    const file = path.join(shots ?? '/tmp', 'sheets-check.pdf');
    await dl.saveAs(file);
    const bytes = fs.readFileSync(file);
    const txt = bytes.toString('latin1');
    const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
    check(txt.startsWith('%PDF'), 'pdf: downloaded file is a PDF');
    check(pages === total + 1, `pdf: cover + one sheet per plate (${pages} pages, ${total} plates)`);
    if (!shots) fs.unlinkSync(file);
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('button', { hasText: 'Pobierz listę kawałków' }).click()]);
    const csvPath = path.join('/tmp', 'pieces-check.csv'); await dl2.saveAs(csvPath);
    check(fs.readFileSync(csvPath, 'utf8').split('\n').length > total, 'csv: piece list has a row per piece');
  }
  // kerf 0 and no allowances: the artifact's numbers for the default project (35 plates, see docs/STATUS.md)
  await page.locator('button', { hasText: 'Rzaz, obcięcie' }).first().click();
  await page.locator('button', { hasText: 'Jak w pierwowzorze' }).click();
  check((await page.locator('.stat', { hasText: 'utracona w rzazie' }).count()) === 1, 'shared cut with the default 3 mm kerf reports the area lost in cuts');
  await page.click('#calc');
  await page.waitForFunction(() => !document.body.innerText.includes('utracona w rzazie') && !document.querySelector('.total.stale') && !document.querySelector('.stale'), null, { timeout: 60000 });
  check((await stat(page, 'płyt razem')) === '35', 'artifact settings (kerf 0, no allowances) give the artifact result: 35 plates');
  // language switch: English strings, Polish decimal comma vs English decimal point
  await page.click('#tab-salon');
  const netPl = await stat(page, 'powierzchnia netto');
  check(/^\d+,\d m²$/.test(netPl), `locale: Polish number format has a decimal comma (${netPl})`);
  await page.locator('button', { hasText: 'Menu' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  check((await page.locator('h1').first().innerText()).length > 0 && (await page.locator('[data-room=salon] h1').innerText()) === 'Room 1', 'language: generic room name switches to English');
  const netEn = await stat(page, 'net area');
  check(/^\d+\.\d m²$/.test(netEn), `locale: English number format has a decimal point (${netEn})`);
  check((await page.evaluate(() => document.documentElement.lang)) === 'en', 'language: <html lang> follows');
  await page.locator('button', { hasText: 'Menu' }).click();
  await page.getByRole('menuitemradio', { name: 'Polski' }).click();
  check((await page.locator('[data-room=salon] h1').innerText()) === 'Pomieszczenie 1', 'language: back to Polish');
  // names: rename a room in place (double-click on the tab, pencil next to the heading), a surface, a feature; example project
  await page.locator('#tab-salon').dblclick();
  await page.getByLabel('Nazwa: Pomieszczenie 1').fill('Salon z kominkiem');
  await page.keyboard.press('Enter');
  check((await page.locator('#tab-salon').innerText()) === 'Salon z kominkiem', 'names: double-click on the tab renames the room');
  check((await page.locator('[data-room=salon] h1').innerText()) === 'Salon z kominkiem', 'names: the heading follows');
  await page.getByRole('button', { name: 'Zmień nazwę: Salon z kominkiem' }).click();
  await page.keyboard.press('Escape');
  check((await page.locator('#tab-salon').innerText()) === 'Salon z kominkiem', 'names: Escape keeps the old name');
  await page.getByRole('button', { name: 'Zmień nazwę: Dach' }).click();
  await page.getByLabel('Nazwa: Dach').fill('Dach od ogrodu');
  await page.keyboard.press('Enter');
  check((await page.locator('#surface-h').innerText()).includes('Dach od ogrodu'), 'names: a surface is renamed and the heading shows it');
  check((await page.locator('.surf', { hasText: 'Dach od ogrodu' }).count()) === 1, 'names: the surface list shows the custom name');
  await page.getByRole('button', { name: 'Zmień nazwę: Salon z kominkiem' }).click();
  await page.getByLabel('Nazwa: Salon z kominkiem').fill('');
  await page.keyboard.press('Enter');
  check((await page.locator('#tab-salon').innerText()) === 'Pomieszczenie 1', 'names: an empty name restores the generic one');
  await page.locator('button', { hasText: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Otwórz przykład: dom z poddaszem' }).click();
  await page.waitForSelector('#tab-salon');
  check((await page.locator('[role=tab]').allInnerTexts()).slice(1, 5).join('|') === 'Salon|Sypialnia|Łazienka 1|Łazienka 2', 'names: the example project has the owner\'s names');
  check((await page.locator('body').innerText()).match(/przy wpuście|wpust:|wpustu|\(wpust\)/i) === null, 'names: "wpust" is not used for the recess any more (it only means the groove)');
  // surface editor: keyboard nudge and drag of the start point, typed measurement on the drawing
  await page.click('#tab-salon');
  const handle = page.locator('.handle').first();
  await handle.focus();
  const sv = async () => page.locator('#o_salon_1').inputValue();
  await page.keyboard.press('ArrowDown');
  check((await sv()) === '1', 'editor: arrow key nudges the start point by 1 cm');
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 30, { steps: 6 });
  const readout = await page.locator('.readout').textContent();
  check(/R1/.test(readout) && /cm/.test(readout), `editor: live readout while dragging ("${readout}")`);
  await page.mouse.up();
  check(Number(await sv()) > 20, `editor: dragging moved the start point (${await sv()} cm)`);
  await page.keyboard.press('Control+z');
  await page.locator('#tab-lazienka-2').click();
  await page.locator('.meas').first().click();
  await page.keyboard.type('70');
  await page.keyboard.press('Enter');
  await panel(page, 'dims');
  await page.locator('.surf').nth(1).click();
  check((await page.locator('[data-testid=split-hint]').innerText()).includes('70'), 'editor: a dimension typed on the drawing changes the room (wood band 70 cm)');
  await page.keyboard.press('Escape');
  await page.click('#tab-salon');
  // inline validation: plain-words error with the field's real name, aria wiring, corrected on blur
  await page.click('#tab-salon');
  await panel(page, 'dims');
  const W = page.locator('#p_salon_l');
  await W.fill('5000');
  check((await W.getAttribute('aria-invalid')) === 'true', 'validation: aria-invalid on an out-of-range value');
  const errId = await W.getAttribute('aria-describedby');
  const errText = errId ? await page.locator('#' + errId).innerText() : '';
  check(/maks\. 3000 cm/.test(errText) && !/\bL:/.test(errText), `validation: message names the field in words ("${errText}")`);
  await W.blur();
  check((await W.inputValue()) === '3000', 'validation: value corrected on blur to what the plan uses');
  await W.fill('980');
  // undo / redo, reset with undo toast
  await W.fill('600');
  await page.locator('h1').first().click();
  await page.keyboard.press('Control+z');
  check((await W.inputValue()) === '980', 'undo: Ctrl+Z restores the previous value');
  await page.keyboard.press('Control+Shift+z');
  check((await W.inputValue()) === '600', 'redo: Ctrl+Shift+Z re-applies it');
  await page.locator('button', { hasText: 'Przywróć wymiary domyślne' }).first().click();
  check((await W.inputValue()) === '980', 'reset: "Przywróć wymiary domyślne" restores the defaults');
  await page.locator('[data-sonner-toast] button', { hasText: 'Cofnij' }).click();
  check((await W.inputValue()) === '600', 'reset: the undo toast brings the dimensions back');
  await W.fill('980');
  // stale result stays visible, dimmed and labelled
  await page.locator('button', { hasText: 'Przelicz tylko to pomieszczenie' }).click();
  await page.waitForSelector('.sheets svg', { timeout: 30000 });
  await panel(page, 'dims');
  await page.locator('#p_salon_l').fill('1010');
  check((await page.locator('.centre .badge', { hasText: 'Nieaktualne – przelicz' }).count()) === 1, 'stale: label shown after an edit');
  check((await page.locator('.sheets svg').count()) > 0, 'stale: the old plates stay visible');
  await panel(page, 'dims');
  await page.locator('#p_salon_l').fill('980');
  // autosave survives a reload
  await page.click('#tab-salon');
  await panel(page, 'dims');
  await page.locator('#p_salon_l').fill('900');
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForSelector('[role=tab]');
  await page.click('#tab-salon');
  await panel(page, 'dims');
  check((await page.locator('#p_salon_l').inputValue()) === '900', 'autosave: value survives a reload');
  // dark mode
  const bg0 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.locator('button', { hasText: 'Menu' }).click();
  await page.getByRole('menuitemradio', { name: /ciemny/ }).click();
  const bg1 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg0 !== bg1, `theme toggle changes the background (${bg0} -> ${bg1})`);
  // share link round trip
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('button', { hasText: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Kopiuj link do kopii' }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  check(link.includes('#p='), 'share link copied');
  const page2 = await ctx.newPage();
  await page2.goto(link);
  await page2.waitForSelector('[role=tab]');
  await page2.click('#tab-salon');
  await panel(page2, 'dims');
  check((await page2.locator('#p_salon_l').inputValue()) === '900', 'share link: opens the same project');
  check((await page.locator('[data-sync=local]').innerText()) === 'Zapis tylko w tej przeglądarce', 'no API: quiet browser-only status');
  await ctx.close();
}

// ---------------- overview and band (desktop)
{
  const { ctx, page } = await open({ width: 1280, height: 1400 }, 2);
  // overview: total, items table (rooms and band), plates, export, project settings
  await page.click('#calc2');
  await page.waitForSelector('[data-testid=project-total]', { timeout: 60000 });
  check(/\d+ płyt.* · .* zł · odpad \d+%/.test(await page.locator('[data-testid=project-total]').innerText()), 'overview: project total (plates · zł · waste)');
  check((await page.locator('[data-testid=items-table] tbody tr').count()) === 5, 'overview: table has four rooms and the band');
  await page.waitForSelector('.sheets svg', { timeout: 60000 });
  check((await page.locator('button', { hasText: 'Pobierz PDF' }).count()) === 1 && (await page.locator('button', { hasText: 'Pobierz listę kawałków' }).count()) === 1, 'overview: PDF and CSV export');
  check((await page.locator('#project-settings').count()) === 1 && (await page.locator('[data-testid=plate-settings]').count()) === 1, 'overview: "Ustawienia projektu" with the plate settings');
  await page.locator('button', { hasText: 'Rzaz, obcięcie' }).first().click();
  for (const id of ['pl_len', 'pl_wid', 'pl_prof', 'pl_tg', 'kerf', 'trim', 'minoff', 'price', 'split', 'guil', 'al_on']) {
    check((await page.locator('#' + id).count()) >= 1, `overview settings: #${id} is there`);
  }
  // opening an item from its row
  await page.locator('[data-open=salon]').click();
  await page.waitForSelector('[data-room=salon] h1');
  check(await page.locator('[data-rail]:visible').count() > 0, 'room: the measurement rail is there');
  await page.click('#tab-przeglad');
  check((await page.locator('[data-rail]:visible').count()) === 0 && (await page.locator('#measure-panel').count()) === 0, 'overview: no measurement rail or panel');
  // with the artifact's settings (kerf 0) the band is cut partly from offcuts
  await page.locator('button', { hasText: 'Rzaz, obcięcie' }).first().click();
  await page.locator('button', { hasText: 'Jak w pierwowzorze' }).click();
  await page.click('#calc');
  await page.waitForFunction(() => !document.querySelector('.stale') && document.querySelector('[data-testid=project-total]'), null, { timeout: 60000 });
  await page.locator('[data-open=band-b1]').click();
  await page.waitForSelector('[data-room=band-b1] h1');
  check((await page.locator('[data-room=band-b1] h1').innerText()).includes('Opaska'), 'band: its own page');
  check((await page.locator('[data-rail]:visible').count()) === 0 && (await page.locator('#measure-panel').count()) === 0, 'band page: no measurement rail or panel');
  // band page: measures, result, drawing with vertical grain; no price, no split at bends
  for (const id of ['b_on', 'b_len', 'b_h', 'b_min', 'b_max', 'b_use']) check((await page.locator('#' + id).count()) === 1, `band: #${id}`);
  check((await page.locator('#price, #split').count()) === 0, 'band: no price and no split at bends');
  await page.waitForSelector('[data-testid=band-drawing] svg', { timeout: 60000 });
  const segs = await page.locator('[data-testid=band-drawing] [data-seg]').count();
  check(segs > 5 && (await page.locator('[data-testid=band-drawing] [data-seg][data-from=offcuts]').count()) > 0, `band: drawing of ${segs} segments, some from offcuts`);
  check(/cm ze ścinków, \d+ cm z \d+ dokupion/.test(await page.locator('[data-testid=band-result]').innerText()), 'band: result in cm from offcuts and from new plates');
  // changing the length recalculates; switching it off removes it from the cut
  await page.fill('#b_len', '824');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=band-drawing] [data-seg]').length === 7, null, { timeout: 60000 });
  check(true, 'band: length 824 cm gives 7 segments');
  await page.locator('#b_on').click();
  await page.waitForSelector('[data-testid=band-result]', { state: 'detached', timeout: 60000 });
  await page.locator('#b_on').click();
  // rename on the tab; the overview row follows
  await page.locator('#tab-band-b1').dblclick();
  await page.getByLabel(/Nazwa:/).fill('Opaska dolna');
  await page.keyboard.press('Enter');
  check((await page.locator('#tab-band-b1').innerText()) === 'Opaska dolna', 'band: renamed on its tab');
  await page.click('#tab-przeglad');
  check((await page.locator('[data-open=band-b1]').innerText()).includes('Opaska dolna'), 'overview: the band row shows the new name');
  // keyboard: roving tabindex with the overview as first tab
  await page.locator('#tab-przeglad').focus();
  check((await page.locator('#tab-przeglad').getAttribute('tabindex')) === '0' && (await page.locator('#tab-salon').getAttribute('tabindex')) === '-1', 'tabs: the overview is the only tab stop');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  check((await page.locator('#tab-salon').getAttribute('aria-selected')) === 'true' && (await page.locator('#tab-przeglad').getAttribute('tabindex')) === '-1', 'tabs: ArrowRight from Przegląd opens the first room');
  await page.keyboard.press('Home');
  await page.waitForTimeout(150);
  check((await page.locator('#tab-przeglad').getAttribute('aria-selected')) === 'true', 'tabs: Home goes to Przegląd');
  await page.keyboard.press('End');
  await page.waitForTimeout(150);
  check((await page.locator('#tab-band-b1').getAttribute('aria-selected')) === 'true', 'tabs: End goes to the band');
  // remove the band (undo restores it), add it again from "+ Dodaj"
  await page.locator('button', { hasText: 'Usuń opaskę' }).click();
  await page.waitForSelector('#tab-band-b1', { state: 'detached' });
  check((await page.locator('#tab-przeglad').getAttribute('aria-selected')) === 'true', 'band removed: back on the overview');
  await page.locator('[data-add-tab]').click();
  await page.locator('[data-template=band]').click();
  await page.waitForSelector('#tab-band-b1, [role=tab][id^=tab-band-]');
  check((await page.locator('[role=tab][id^=tab-band-]').count()) === 1, 'band template: the band item is added and opened');
  await page.locator('[data-add-tab]').click();
  check((await page.locator('[data-template=band]').innerText()).includes('już w projekcie'), 'one band per project: the picker says it is already there');
  await page.keyboard.press('Escape');
  await page.locator('#undo').click();
  await page.waitForSelector('#tab-band-b1', { state: 'detached' });
  await page.locator('#undo').click();
  await page.waitForSelector('#tab-band-b1');
  if (shots) { await page.click('#tab-przeglad'); await page.waitForSelector('.sheets svg'); await page.screenshot({ path: path.join(shots, 'overview-1280.png'), fullPage: true }); await page.click('#tab-band-b1'); await page.waitForSelector('[data-testid=band-drawing] svg'); await page.screenshot({ path: path.join(shots, 'band-1280.png'), fullPage: true }); }
  await ctx.close();
}

// ---------------- critique fixes and openings (desktop)
{
  const { ctx, page } = await open({ width: 1280, height: 900 });
  await page.click('#tab-salon');
  // tabs pattern: arrow keys move focus and selection, only the selected tab is in the tab order
  await page.locator('#tab-salon').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  check((await page.locator('#tab-sypialnia').getAttribute('aria-selected')) === 'true', 'tabs: ArrowRight selects the next room');
  check((await page.locator('#tab-salon').getAttribute('tabindex')) === '-1', 'tabs: roving tabindex');
  await page.click('#tab-salon');
  // an emptied field stays empty, is flagged, and the total says the dimension is missing; no undo step is created
  const undoBefore = await page.locator('#undo').isDisabled();
  await panel(page, 'dims');
  await page.fill('#p_salon_l', '');
  await panel(page, 'dims');
  await page.locator('#p_salon_l').blur();
  await panel(page, 'dims');
  check((await page.locator('#p_salon_l').inputValue()) === '', 'empty: the field stays empty on blur');
  await panel(page, 'dims');
  check((await page.locator('#p_salon_l').getAttribute('aria-invalid')) === 'true', 'empty: aria-invalid');
  check((await page.locator('.ferr', { hasText: 'Wpisz' }).count()) === 1, 'empty: "Wpisz …" under the field');
  check((await page.locator('.total').innerText()).includes('brak wymiaru'), 'empty: the total says brak wymiaru');
  check((await page.locator('#undo').isDisabled()) === undoBefore, 'empty: no undo step');
  await panel(page, 'dims');
  await page.fill('#p_salon_l', '548');
  await panel(page, 'dims');
  await page.locator('#p_salon_l').blur();
  // dependent limit explains its reason
  await panel(page, 'dims');
  await page.fill('#p_salon_n_recess_a', '900');
  await panel(page, 'dims');
  check((await page.locator('#p_salon_n_recess_a-err').innerText()).includes('bo '), 'dependent limit names the other dimension');
  await panel(page, 'dims');
  await page.locator('#p_salon_n_recess_a').blur();
  // openings: add a window on the gable wall, drag it, the cut recalculates by itself
  await page.click('.surf[data-ref=R2]');
  await panel(page, 'openings');
  const before = await page.locator('.ol li').count();
  await page.click('button:has-text("Dodaj okno")');
  check((await page.locator('.ol li').count()) === before + 1, 'openings: window added');
  // Esc closes the panel and the focus goes back to the rail button that opened it
  await page.keyboard.press('Escape');
  check((await page.locator('#measure-panel').isHidden()), 'panel: Esc closes it');
  check((await page.evaluate(() => document.activeElement?.getAttribute('data-rail'))) === 'openings', 'panel: Esc returns the focus to the rail button');
  const body = page.locator('.op-body').last();
  await body.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -260));
  const box = await body.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 20, { steps: 4 });
  await page.mouse.up();
  const moved = await body.boundingBox();
  check(Math.abs(moved.x - box.x - 40) < 8 && moved.y < box.y, 'openings: dragging moves the window (snapped to whole cm or an edge)');
  await page.waitForFunction(() => !!document.querySelector('.calcstate.fresh'), null, { timeout: 60000 });
  check(true, 'openings: the cut recalculates automatically');
  await page.locator('.op-body').last().press('Delete');
  check((await page.locator('.ol li').count()) === before, 'openings: Delete removes the opening');
  await page.keyboard.press('Escape');
  // handle name and tab order
  await page.click('.surf[data-ref=R1]');
  check((await page.locator('[role=slider]').first().getAttribute('aria-label')).includes('przeciągnij'), 'start handle: specific accessible name');
  await ctx.close();
}


// ---------------- 2D | 3D switch in the drawing's header
{
  // the share of pixels that are the chalk blue of the highlight, in a screenshot of the 3D canvas (joints and numbers off)
  const blue = async (page) => page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > d[i] + 45 && d[i + 2] > d[i + 1] + 15) n++;
    return n;
  }, (await page.locator('.v3-canvas').screenshot()).toString('base64'));
  const { ctx, page } = await open({ width: 1280, height: 900 }, 1);
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  await page.click('#tab-salon');
  check((await page.locator('#v3-h, #show3d').count()) === 0, '3D switch: there is no separate "Model 3D" card');
  check((await page.locator('#view-2d').getAttribute('aria-pressed')) === 'true' && (await page.locator('#view-3d').getAttribute('aria-pressed')) === 'false', '3D switch: 2D is shown by default');
  check((await page.locator('[data-opt]').count()) === 0, '3D switch: the 3D options are not in the header while 2D is shown');
  check(!reqs.some((u) => /View3D/.test(u)) && (await page.locator('.v3-canvas').count()) === 0, '3D switch: three.js is not loaded while only 2D is used');
  await page.waitForSelector('.calcstate.fresh', { timeout: 30000 }); // the top bar changes height while the project total is calculated: measure after it settled
  const f2 = await page.locator('[data-frame]').boundingBox();
  const hdr2 = await page.locator('[data-view-switch]').boundingBox();
  await page.click('#view-3d');
  await page.waitForSelector('.v3-canvas canvas', { timeout: 30000 });
  check(reqs.some((u) => /View3D/.test(u)), '3D switch: three.js is loaded on the first switch to 3D (lazy chunk)');
  await page.evaluate(() => window.scrollTo(0, 0));
  const f3 = await page.locator('[data-frame]').boundingBox();
  check(Math.abs(f3.x - f2.x) < 1.5 && Math.abs(f3.y - f2.y) < 1.5 && Math.abs(f3.width - f2.width) < 1.5 && Math.abs(f3.height - f2.height) < 3, `3D switch: 3D takes the frame of the drawing (${Math.round(f2.width)}x${Math.round(f2.height)} at ${Math.round(f2.x)},${Math.round(f2.y)} -> ${Math.round(f3.width)}x${Math.round(f3.height)} at ${Math.round(f3.x)},${Math.round(f3.y)})`);
  const hdr3 = await page.locator('[data-view-switch]').boundingBox();
  check(Math.abs(hdr3.x - hdr2.x) < 1.5 && Math.abs(hdr3.y - hdr2.y) < 1.5, '3D switch: the switch itself does not move');
  check((await page.locator('[data-opt]').allInnerTexts()).join('|') === 'Dach|Styki|Numery|Start R', '3D switch: compact toggles for roof, joints, numbers and start points in the header');
  check((await page.locator('#surface-h').count()) === 1 && (await page.locator('[aria-label="Powiększ rysunek"]').count()) === 0, '3D switch: zoom buttons are 2D only');
  check((await page.locator('#v3-sum').innerText()).includes('model 3D'), '3D: text summary for screen readers');
  await page.locator('.v3-canvas').focus();
  await page.keyboard.press('ArrowLeft');
  check((await page.locator('.v3-canvas').getAttribute('role')) === 'group', '3D: keyboard orbit stays (canvas focusable group)');
  await page.locator('[data-opt=roof]').click();
  check((await page.locator('[data-opt=roof]').getAttribute('aria-pressed')) === 'false', '3D: roof toggle');
  await page.locator('[data-opt=roof]').click();
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(noScroll, '3D switch: no horizontal page scroll at 1280');
  const shotAt = async (name) => { await page.evaluate(() => { const h = document.querySelector('[data-view-header]'); window.scrollTo(0, window.scrollY + h.getBoundingClientRect().top - 230); }); await page.waitForTimeout(900); await page.screenshot({ path: path.join(shots, name) }); };
  if (shots) { await page.click('.surf[data-ref=R3]'); await shotAt('salon-3d-1280.png'); await page.click('#view-2d'); await page.waitForSelector('[data-frame] svg'); await shotAt('salon-2d-1280.png'); await page.click('#view-3d'); await page.waitForSelector('.v3-canvas canvas'); }

  // selection: list -> 3D (the selected surface is highlighted), 3D -> list and drawing
  await page.locator('[data-opt=grid]').click();
  await page.locator('[data-opt=numbers]').click();
  await page.locator('[data-opt=refs]').click();
  await page.click('.surf[data-ref=R1]');
  await page.waitForTimeout(500);
  const sel1 = await page.locator('.v3-canvas').getAttribute('data-selected-surf');
  const b1 = await blue(page);
  check(b1 > 300, `3D selection: the surface chosen in the list is highlighted in 3D (${b1} px)`);
  await page.click('.surf[data-ref=R3]');
  await page.waitForTimeout(500);
  const sel3 = await page.locator('.v3-canvas').getAttribute('data-selected-surf');
  check(sel1 !== sel3 && (await page.locator('.surf[data-ref=R3]').getAttribute('aria-current')) === 'true', `3D selection: choosing another surface in the list moves the highlight (${sel1} -> ${sel3})`);
  // click around the canvas: every click on a surface selects it in the list, and the highlight follows
  const cb = await page.locator('.v3-canvas').boundingBox();
  const seen = new Set();
  let synced = true;
  for (let iy = 1; iy < 7; iy++) for (let ix = 1; ix < 9; ix++) {
    await page.mouse.click(cb.x + cb.width * ix / 9, cb.y + cb.height * iy / 7);
    const cur = await page.locator('.surf[aria-current=true]').getAttribute('data-ref');
    const hl = await page.locator('.v3-canvas').getAttribute('data-selected-surf');
    seen.add(cur);
    const listKey = await page.locator('.surf[aria-current=true]').evaluate((el) => el.getAttribute('data-ref'));
    if (!listKey || hl === null) synced = false;
  }
  check(seen.size >= 3 && synced, `3D selection: clicking surfaces in 3D selects them in the list (${[...seen].join(', ')})`);
  // a drag (orbit) is not a click: the selection stays
  const before = await page.locator('.surf[aria-current=true]').getAttribute('data-ref');
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down(); await page.mouse.move(cb.x + cb.width / 2 + 90, cb.y + cb.height / 2 + 20, { steps: 6 }); await page.mouse.up();
  check((await page.locator('.surf[aria-current=true]').getAttribute('data-ref')) === before, '3D selection: dragging to orbit does not change the selection');
  // 3D -> 2D: the drawing shows the surface that was clicked in 3D
  const chosen = await page.locator('.surf[aria-current=true] .nm').innerText();
  await page.click('#view-2d');
  await page.waitForSelector('[data-frame] svg');
  check((await page.locator('#surface-h').innerText()).includes(before), '3D selection: back in 2D the drawing shows the surface selected in 3D');
  // 2D -> 3D: a surface chosen in the 2D view is highlighted in 3D
  await page.click('.surf[data-ref=R2]');
  await page.click('#view-3d');
  await page.waitForSelector('.v3-canvas canvas');
  await page.waitForTimeout(500);
  check((await page.locator('.v3-canvas').getAttribute('data-selected-surf')) !== null && (await blue(page)) > 300, '3D selection: a surface chosen in the 2D view is highlighted when switching to 3D');
  void chosen;

  // remembered
  await page.reload();
  await page.waitForSelector('[role=tab]');
  await page.click('#tab-salon');
  await page.waitForSelector('.v3-canvas canvas', { timeout: 30000 });
  check((await page.locator('#view-3d').getAttribute('aria-pressed')) === 'true', '3D switch: the choice (3D) is remembered after a reload');
  check((await page.locator('[data-opt=grid]').getAttribute('aria-pressed')) === 'false', '3D switch: the toggles are remembered too');
  await page.click('#tab-sypialnia');
  check((await page.locator('#view-3d').getAttribute('aria-pressed')) === 'true' && (await page.locator('.v3-canvas canvas').count()) === 1, '3D switch: the choice holds when another room is opened');
  await page.click('#view-2d');
  await page.reload();
  await page.waitForSelector('[role=tab]');
  await page.click('#tab-salon');
  check((await page.locator('#view-2d').getAttribute('aria-pressed')) === 'true' && (await page.locator('.v3-canvas').count()) === 0, '3D switch: the choice (2D) is remembered after a reload');

  // with the measurement panel: 3D keeps its frame, the panel overlays it (1280) or sits beside it (1500 pinned)
  await page.click('#view-3d');
  await page.waitForSelector('.v3-canvas canvas');
  const fa = await page.locator('[data-frame]').boundingBox();
  await page.locator('[data-panel-rail] [data-rail=starts]').click();
  await page.waitForSelector('[data-panel-state=overlay]');
  const fb = await page.locator('[data-frame]').boundingBox();
  check(Math.abs(fb.width - fa.width) < 1 && Math.abs(fb.x - fa.x) < 1, '3D switch: the measurement panel overlays the 3D frame without moving it');
  await page.keyboard.press('Escape');
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 1500, height: 900 }, 1);
  await page.click('#tab-salon');
  await page.click('#view-3d');
  await page.waitForSelector('.v3-canvas canvas', { timeout: 30000 });
  await page.locator('[data-panel-rail] [data-rail=starts]').click();
  await page.waitForSelector('[data-panel-state=overlay]');
  await page.locator('[aria-label*="Przypnij"], [data-pin]').first().click().catch(() => {});
  const pinned = (await page.locator('#measure-panel').getAttribute('data-panel-state')) === 'pinned';
  if (pinned) {
    const fr = await page.locator('[data-frame]').boundingBox(), pn = await page.locator('#measure-panel').boundingBox();
    check(fr.x + fr.width <= pn.x + 1 && (await page.locator('.v3-canvas canvas').count()) === 1, '3D switch: with the panel pinned the 3D frame sits beside it');
  }
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '3D switch: no horizontal page scroll at 1500 with the panel');
  await ctx.close();
}
// ---------------- roof sheet: one unrolled grid per room, splits chosen by clicking (docs/briefs/unrolled-room-grid.md)
{
  const { ctx, page } = await open({ width: 1280, height: 900 });
  await page.click('#tab-salon');
  await page.waitForSelector('[data-frame] svg.mark');
  const names = await page.locator('.surf .nm').allInnerTexts();
  check(names.length === 5 && /Dach/.test(names[0]) && !names.some((n) => /Połać/.test(n)), `sheet: the surface list is "Dach" + the gable walls (${names.length} entries)`);
  check((await page.locator('.surf[data-ref]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ref')).join(','))) === 'R1,R2,R3,R4,R5', 'sheet: start points R1..R5 (one for the roof, one per gable)');
  const svgText = await page.locator('[data-frame] svg.mark').first().textContent();
  check(['kalenica', 'zgięcie dach/ściana', 'ściana wycięcia'].every((t) => svgText.includes(t)), 'sheet: fold lines are labelled (kalenica, zgięcie dach/ściana, ściana wycięcia)');
  check((await page.locator('[data-frame] svg.mark text.mk-num').count()) >= 7, 'sheet: numbered strips across the whole roof');
  const pieces = async () => Number(await stat(page, 'kawałków do cięcia'));
  const p0 = await pieces();
  // keyboard: every split line is focusable and a switch
  const line = (strip, fold) => page.locator(`[role=switch][aria-label^="Pasek ${strip}: ${fold},"]`);
  const ridge2 = line(2, 'kalenica');
  check((await ridge2.getAttribute('aria-checked')) === 'true' && (await line(2, 'zgięcie dach/ściana').count()) === 2, 'sheet: defaults - ridge split, both folds split (setting "Dziel kawałki na zgięciach" is on)');
  // joining the ridge makes a piece longer than the plate: refused with a message on that strip
  await ridge2.focus();
  await page.keyboard.press('Enter');
  check(await page.locator('[data-join-msg]').isVisible() && (await ridge2.getAttribute('aria-checked')) === 'true', 'sheet: joining across the ridge is refused when the piece would be longer than a plate');
  check((await pieces()) === p0, 'sheet: a refused join changes nothing');
  // joining a fold that fits: fewer pieces, undo restores
  const eave = line(2, 'zgięcie dach/ściana').first();
  await eave.focus();
  await page.keyboard.press('Space');
  await page.waitForFunction((n) => { const el = [...document.querySelectorAll('.stat')].find((q) => q.textContent.includes('kawałków do cięcia')); return el && Number(el.querySelector('b').textContent) < n; }, p0);
  check((await eave.getAttribute('aria-checked')) === 'false', 'sheet: Space joins a fold of one strip');
  await page.keyboard.press('Control+z');
  check((await eave.getAttribute('aria-checked')) === 'true' && (await pieces()) === p0, 'sheet: the split choice is undoable');
  // header action: one choice for the whole line
  await page.locator('[data-split-menu]').click();
  await page.locator('[data-join-all=eaveL]').click();
  await page.waitForFunction((n) => { const el = [...document.querySelectorAll('.stat')].find((q) => q.textContent.includes('kawałków do cięcia')); return el && Number(el.querySelector('b').textContent) < n; }, p0);
  const states = await page.locator('[role=switch][aria-label*="zgięcie dach/ściana"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked')));
  check(states.length > 0 && states.filter((x) => x === 'false').length >= 7, `sheet: "Połącz wszystkie" joins a whole line (${states.filter((x) => x === 'false').length} strips)`);
  await page.locator('[data-split-menu]').click();
  await page.locator('[data-split-reset]').click();
  await page.waitForFunction((n) => { const el = [...document.querySelectorAll('.stat')].find((q) => q.textContent.includes('kawałków do cięcia')); return el && Number(el.querySelector('b').textContent) === n; }, p0);
  check(true, 'sheet: default splits restored from the menu');
  // cross-cut: Enter on a strip adds one (tongue and groove end joint), arrows move it, Delete removes it
  const strip3 = page.locator('rect.sp-strip[aria-label^="Pasek 3:"]');
  await strip3.focus();
  await page.keyboard.press('Enter');
  const cut = page.locator('.sp-cut[aria-label^="Pasek 3: cięcie poprzeczne"]');
  await cut.waitFor();
  const v0 = Number(await cut.getAttribute('aria-valuenow'));
  check((await pieces()) === p0 + 1, 'sheet: Enter on a strip adds a cross-cut (one more piece)');
  await cut.focus();
  await page.keyboard.press('ArrowRight');
  check(Number(await cut.getAttribute('aria-valuenow')) === v0 + 1, 'sheet: arrow keys move a cross-cut');
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => !document.querySelector('.sp-cut'));
  check((await pieces()) === p0, 'sheet: Delete removes the cross-cut');
  // mouse: click on a strip adds a cut at that place, drag moves it, click removes it
  const sb = await page.locator('rect.sp-strip[aria-label^="Pasek 4:"]').boundingBox();
  await page.mouse.click(sb.x + sb.width * 0.3, sb.y + sb.height / 2);
  await page.locator('.sp-cut').first().waitFor();
  const c0 = await page.locator('.sp-cut').first().boundingBox();
  const u1 = Number(await page.locator('.sp-cut').first().getAttribute('aria-valuenow'));
  await page.mouse.move(c0.x + c0.width / 2, c0.y + c0.height / 2);
  await page.mouse.down();
  await page.mouse.move(c0.x + c0.width / 2 + 60, c0.y + c0.height / 2, { steps: 6 });
  await page.mouse.up();
  const u2 = Number(await page.locator('.sp-cut').first().getAttribute('aria-valuenow'));
  check(u2 > u1 + 40 && (await page.locator('.sp-cut').count()) === 1, `sheet: dragging a cross-cut moves it (${u1} -> ${u2})`);
  const c1 = await page.locator('.sp-cut').first().boundingBox();
  await page.mouse.click(c1.x + c1.width / 2, c1.y + c1.height / 2);
  await page.waitForFunction(() => !document.querySelector('.sp-cut'));
  check(true, 'sheet: clicking a cross-cut removes it');
  // the start point R1 is draggable like before and the grid follows (strip 1 changes width)
  await page.locator('.handle').first().focus();
  await page.keyboard.press('ArrowDown');
  check((await page.locator('.handle').first().getAttribute('aria-valuenow')) === '1', 'sheet: the single start point R1 moves the whole roof grid');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sheet: no horizontal page scroll at 1280');
  if (shots) { await page.keyboard.press('Control+z'); await page.locator('[data-view-header]').scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await page.screenshot({ path: path.join(shots, 'salon-sheet-1280.png') }); }
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 2);
  await page.click('#tab-salon');
  await page.waitForSelector('[data-frame] svg.mark');
  const hb = await page.locator('[data-split-menu]').boundingBox();
  check(hb.width >= 44 && hb.height >= 44, `sheet phone: the Podziały button is touchable (${Math.round(hb.width)}x${Math.round(hb.height)})`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sheet phone: no horizontal page scroll');
  const lines = await page.locator('[role=switch]').count();
  check(lines > 10, `sheet phone: ${lines} split lines to tap`);
  if (shots) { await page.locator('[data-view-header]').scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await page.screenshot({ path: path.join(shots, 'salon-sheet-390.png') }); }
  await ctx.close();
}

{
  const { ctx, page } = await open({ width: 390, height: 844 }, 2);
  await page.click('#tab-salon');
  const f2 = await page.locator('[data-frame]').boundingBox();
  await page.click('#view-3d');
  await page.waitForSelector('.v3-canvas canvas', { timeout: 30000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const f3 = await page.locator('[data-frame]').boundingBox();
  check(Math.abs(f3.x - f2.x) < 1.5 && Math.abs(f3.y - f2.y) < 1.5 && Math.abs(f3.width - f2.width) < 1.5 && Math.abs(f3.height - f2.height) < 3, `phone 3D: same frame as the 2D drawing (${Math.round(f2.width)}x${Math.round(f2.height)} -> ${Math.round(f3.width)}x${Math.round(f3.height)})`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'phone 3D: no horizontal page scroll');
  const opts = await page.locator('[data-opt]').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { r: b.right, w: b.width, h: b.height }; }));
  check(opts.length === 4 && opts.every((o) => o.r <= 390 && o.h >= 40), `phone 3D: the four toggles fit in the header and are large enough (${opts.map((o) => Math.round(o.w) + 'x' + Math.round(o.h)).join(' ')})`);
  const sw = await page.locator('#view-3d').boundingBox();
  check(sw.height >= 40 && sw.width >= 44, `phone 3D: the 2D|3D switch is touchable (${Math.round(sw.width)}x${Math.round(sw.height)})`);
  // a tap on a surface selects it
  await page.locator('.v3-canvas').scrollIntoViewIfNeeded();
  const cb = await page.locator('.v3-canvas').boundingBox();
  const start = await page.locator('.surf[aria-current=true]').getAttribute('data-ref');
  const seen = new Set([start]);
  for (let iy = 1; iy < 6 && seen.size < 2; iy++) for (let ix = 1; ix < 8 && seen.size < 2; ix++) { await page.mouse.click(cb.x + cb.width * ix / 8, cb.y + cb.height * iy / 6); seen.add(await page.locator('.surf[aria-current=true]').getAttribute('data-ref')); }
  check(seen.size >= 2, 'phone 3D: tapping a surface in 3D selects it');
  if (shots) { await page.locator('[data-view-header]').scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await page.screenshot({ path: path.join(shots, 'salon-3d-390.png') }); }
  await page.click('#view-2d');
  await page.waitForSelector('[data-frame] svg');
  if (shots) { await page.locator('[data-view-header]').scrollIntoViewIfNeeded(); await page.waitForTimeout(500); await page.screenshot({ path: path.join(shots, 'salon-2d-390.png') }); }
  await ctx.close();
}

// ---------------- measurement panel (desktop 1280 and 1500, phone sheet)
{
  const { ctx, page } = await open({ width: 1280, height: 900 }, 1);
  await page.click('#tab-salon');
  const rail = page.locator('[data-panel-rail]');
  const rb = await rail.boundingBox();
  check(Math.abs(rb.width - 56) <= 1, `panel: the rail is 56 px wide (${rb.width})`);
  check((await rail.locator('button').allInnerTexts()).map((t) => t.replace(/\d+$/, '').trim()).join('|') === 'Punkty startu|Otwory|Płyty', 'panel: the rail has three labelled icons (the dimensions are the Kształt section)');
  check(await page.locator('#measure-panel').isHidden(), 'panel: closed by default');
  const frameBefore = await page.locator('main .overflow-hidden.rounded-lg').first().boundingBox();
  await rail.locator('[data-rail=starts]').click();
  const pb = await page.locator('#measure-panel').boundingBox();
  check(Math.abs(pb.width - 380) <= 1, `panel: opens as a 380 px panel (${pb.width})`);
  const frameAfter = await page.locator('main .overflow-hidden.rounded-lg').first().boundingBox();
  check(Math.abs(frameAfter.width - frameBefore.width) < 1, 'panel: overlays the drawing, it does not push it');
  check((await page.locator('#measure-panel').getAttribute('data-panel-state')) === 'overlay', 'panel: overlay mode at 1280 px');
  // an emptied measurement is flagged and can be jumped to
  await page.fill('#p_salon_n_recess_a', '');
  await page.locator('#p_salon_n_recess_a').blur();
  check((await page.locator('#p_salon_n_recess_a-err').count()) === 1, 'shape: an emptied measurement is flagged under its field');
  await page.fill('#p_salon_n_recess_a', '140');
  // a measurement tapped on the drawing: quick popup, with a way into the panel
  await page.keyboard.press('Escape');
  check(await page.locator('#measure-panel').isHidden(), 'panel: Esc closes');
  await page.locator('.meas').first().click();
  await page.locator('.meas-edit button', { hasText: 'Pokaż w panelu' }).click();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => !!document.activeElement?.closest('[data-shape]')), 'shape: "Pokaż" focuses that measurement in Kształt');
  // keyboard: M toggles
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  check(await page.locator('#measure-panel').isVisible(), 'panel: M opens it');
  await page.keyboard.press('m');
  check(await page.locator('#measure-panel').isHidden(), 'panel: M closes it');
  // selecting a surface while a section is open follows: the openings section shows the selected surface's openings
  await page.keyboard.press('m');
  await page.locator('[data-panel-rail] [data-rail=openings]').click();
  await page.click('.surf[data-ref=R2]');
  check((await page.locator('#measure-panel-h').innerText()) === 'Otwory', 'panel: stays on the section while the selected surface changes');
  // remembered after a reload
  await page.reload();
  await page.waitForSelector('[role=tab]');
  await page.click('#tab-salon'); // the project opens on the overview
  check(await page.locator('#measure-panel').isVisible() && (await page.locator('#measure-panel-h').innerText()) === 'Otwory', 'panel: open state and section are remembered');
  if (shots) { await page.locator('[data-panel-rail] [data-rail=starts]').click(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(shots, 'panel-1280.png') }); }
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 1500, height: 900 }, 1);
  await page.click('#tab-salon');
  await page.locator('[data-panel-rail] [data-rail=starts]').click();
  await page.getByRole('button', { name: 'Przypnij panel' }).click();
  check((await page.locator('#measure-panel').getAttribute('data-panel-state')) === 'pinned', 'panel: can be pinned at 1500 px');
  const pinnedFrame = await page.locator('main .overflow-hidden.rounded-lg').first().boundingBox();
  const panelBox = await page.locator('#measure-panel').boundingBox();
  check(pinnedFrame.x + pinnedFrame.width <= panelBox.x + 1, 'panel: pinned beside the drawing, not over it');
  await page.keyboard.press('Escape');
  check(await page.locator('#measure-panel').isVisible(), 'panel: Esc does not close a pinned panel');
  await page.reload();
  await page.waitForSelector('[role=tab]');
  await page.click('#tab-salon');
  check((await page.locator('#measure-panel').getAttribute('data-panel-state')) === 'pinned', 'panel: the pin is remembered');
  await ctx.close();
}

// ---------------- phone
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 2);
  for (const id of ['przeglad', 'salon', 'lazienka-2', 'band-b1']) {
    await page.click(`#tab-${id}`);
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(over <= 0, `phone width: no horizontal page scroll on ${id} (overflow ${over}px)`);
    if (shots && (id === 'przeglad' || id === 'band-b1')) { await page.waitForTimeout(1500); await page.screenshot({ path: path.join(shots, (id === 'przeglad' ? 'overview' : 'band') + '-390.png'), fullPage: true }); }
  }
  await page.click('#tab-salon');
  // phone: the bottom bar shows a status instead of an overflowing button; measurement list with a bottom sheet
  await page.waitForSelector('#calc', { timeout: 60000 });
  const bar = await page.evaluate(() => { const b = document.querySelector('#calc'); const r = b.getBoundingClientRect(); return { w: r.width, over: b.scrollWidth - b.clientWidth }; });
  check(bar.over <= 0, 'phone: the recalculate button does not overflow');
  check((await page.locator('.calcstate').count()) === 1, 'phone: calculation status in the bottom bar');
  await page.locator('.ml-row').nth(2).click();
  await page.fill('.meas-edit input', '2');
  await page.click('.meas-edit .pri');
  check((await page.locator('.meas-edit .ferr').count()) === 1, 'phone: sheet keeps an invalid number open with the reason');
  await page.keyboard.press('Escape');
  {
    const strip = page.locator('[data-panel-strip]');
    check((await strip.locator('button').count()) === 3 && (await page.locator('[data-panel-rail]').isHidden()), 'phone: the three sections are a strip, the rail is hidden');
    await strip.locator('[data-rail=starts]').click();
    await page.waitForSelector('[data-sheet-tab=starts][aria-selected=true]');
    const sb = await page.locator('[role=dialog]').last().boundingBox();
    check(sb.y > 844 * 0.1 && sb.y + sb.height >= 843, 'phone: the sections open as a bottom sheet');
    check((await page.locator('[role=dialog] .shift').count()) > 0, 'phone: the sheet holds the start points');
    if (shots) { await page.waitForTimeout(300); await page.screenshot({ path: path.join(shots, 'panel-390.png') }); }
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role=dialog]', { state: 'detached' });
    check((await page.evaluate(() => document.activeElement?.getAttribute('data-rail'))) === 'starts', 'phone: Esc closes the sheet and returns the focus');
  }
  await audit(page, 'phone salon');
  if (shots) await page.screenshot({ path: path.join(shots, 'phone-salon.png') });
  await ctx.close();
}

check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
