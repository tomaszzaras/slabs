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
const browser = await chromium.launch();
const errors = [];

async function open(viewport, deviceScaleFactor = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, locale: 'pl-PL' });
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
  check((await page.locator('[role=tab]').count()) === 5, 'five tabs: four rooms and the shared cut');
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
    const field = { salon: 'L', sypialnia: 'L', 'lazienka-1': 'L', 'lazienka-2': 'bz' }[id];
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
  await page.click('#tab-rozkroj');
  await page.waitForSelector('#calc');
  await page.click('#calc');
  await page.waitForSelector('.sheets svg', { timeout: 60000 });
  const total = Number(await stat(page, 'płyt razem'));
  check(total > 20 && total < 60, `shared cut: ${total} plates`);
  check((await page.locator('.sheets svg').count()) === total, 'shared cut: one drawing per plate');
  // tongue and groove is the default: P / W letters on the plates, the legend, the comparison with plain plates, plate settings
  check((await page.locator('.sheets svg text.mk-edgeletter').count()) > 0, 'tongue and groove: P / W letters on the plates');
  check((await page.getByText('P pióro, W wpust').count()) > 0, 'tongue and groove: legend under the plates');
  await page.waitForSelector('.stat:has-text("gdyby płyty były gładkie")', { timeout: 60000 });
  check((await page.locator('.stat', { hasText: 'gdyby płyty były gładkie' }).first().innerText()).includes('pióro i wpust'), 'tongue and groove: plate count difference vs plain plates');
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
  await page.getByRole('button', { name: 'Zmień nazwę: Połać lewa' }).click();
  await page.getByLabel('Nazwa: Połać lewa').fill('Dach od ogrodu');
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
  check((await page.locator('[role=tab]').allInnerTexts()).slice(0, 4).join('|') === 'Salon|Sypialnia|Łazienka 1|Łazienka 2', 'names: the example project has the owner\'s names');
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
  check((await page.locator('#p_lazienka-2_hb').inputValue()) === '70', 'editor: a dimension typed on the drawing changes the room input');
  await page.keyboard.press('Escape');
  await page.click('#tab-salon');
  // inline validation: plain-words error with the field's real name, aria wiring, corrected on blur
  await page.click('#tab-salon');
  await panel(page, 'dims');
  const W = page.locator('#p_salon_W');
  await W.fill('5000');
  check((await W.getAttribute('aria-invalid')) === 'true', 'validation: aria-invalid on an out-of-range value');
  const errId = await W.getAttribute('aria-describedby');
  const errText = errId ? await page.locator('#' + errId).innerText() : '';
  check(/maks\. 1200 cm/.test(errText) && !/\bW:/.test(errText), `validation: message names the field in words ("${errText}")`);
  await W.blur();
  check((await W.inputValue()) === '1200', 'validation: value corrected on blur to what the plan uses');
  await W.fill('548');
  // undo / redo, reset with undo toast
  await W.fill('600');
  await page.locator('h1').first().click();
  await page.keyboard.press('Control+z');
  check((await W.inputValue()) === '548', 'undo: Ctrl+Z restores the previous value');
  await page.keyboard.press('Control+Shift+z');
  check((await W.inputValue()) === '600', 'redo: Ctrl+Shift+Z re-applies it');
  await page.locator('button', { hasText: 'Przywróć wymiary domyślne' }).first().click();
  check((await W.inputValue()) === '548', 'reset: "Przywróć wymiary domyślne" restores the defaults');
  await page.locator('[data-sonner-toast] button', { hasText: 'Cofnij' }).click();
  check((await W.inputValue()) === '600', 'reset: the undo toast brings the dimensions back');
  await W.fill('548');
  // stale result stays visible, dimmed and labelled
  await page.locator('button', { hasText: 'Przelicz tylko to pomieszczenie' }).click();
  await page.waitForSelector('.sheets svg', { timeout: 30000 });
  await panel(page, 'dims');
  await page.locator('#p_salon_L').fill('1010');
  check((await page.locator('.centre .badge', { hasText: 'Nieaktualne – przelicz' }).count()) === 1, 'stale: label shown after an edit');
  check((await page.locator('.sheets svg').count()) > 0, 'stale: the old plates stay visible');
  await panel(page, 'dims');
  await page.locator('#p_salon_L').fill('980');
  // autosave survives a reload
  await page.click('#tab-salon');
  await panel(page, 'dims');
  await page.locator('#p_salon_W').fill('600');
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForSelector('[role=tab]');
  await page.click('#tab-salon');
  await panel(page, 'dims');
  check((await page.locator('#p_salon_W').inputValue()) === '600', 'autosave: value survives a reload');
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
  check((await page2.locator('#p_salon_W').inputValue()) === '600', 'share link: opens the same project');
  check((await page.locator('[data-sync=local]').innerText()) === 'Zapis tylko w tej przeglądarce', 'no API: quiet browser-only status');
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
  await page.fill('#p_salon_W', '');
  await panel(page, 'dims');
  await page.locator('#p_salon_W').blur();
  await panel(page, 'dims');
  check((await page.locator('#p_salon_W').inputValue()) === '', 'empty: the field stays empty on blur');
  await panel(page, 'dims');
  check((await page.locator('#p_salon_W').getAttribute('aria-invalid')) === 'true', 'empty: aria-invalid');
  check((await page.locator('.ferr', { hasText: 'Wpisz' }).count()) === 1, 'empty: "Wpisz …" under the field');
  check((await page.locator('.total').innerText()).includes('brak wymiaru'), 'empty: the total says brak wymiaru');
  check((await page.locator('#undo').isDisabled()) === undoBefore, 'empty: no undo step');
  await panel(page, 'dims');
  await page.fill('#p_salon_W', '548');
  await panel(page, 'dims');
  await page.locator('#p_salon_W').blur();
  // dependent limit explains its reason
  await panel(page, 'dims');
  await page.fill('#p_salon_dA', '900');
  await panel(page, 'dims');
  check((await page.locator('#p_salon_dA-err').innerText()).includes('bo '), 'dependent limit names the other dimension');
  await panel(page, 'dims');
  await page.locator('#p_salon_dA').blur();
  // openings: add a window on the gable wall, drag it, the cut recalculates by itself
  await page.click('.surf[data-ref=R6]');
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
  await page.keyboard.press('Escape'); // the panel opened by the selection covers the 3D button
  // 3D view: lazy chunk, canvas, keyboard orbit, text summary
  const reqs = []; page.on('request', (r) => reqs.push(r.url()));
  await page.click('#show3d');
  await page.waitForSelector('.v3-canvas canvas', { timeout: 30000 });
  check(reqs.some((u) => /View3D/.test(u)), '3D: three.js is loaded only when the view is opened');
  check((await page.locator('#v3-sum').innerText()).includes('model 3D'), '3D: text summary for screen readers');
  await page.locator('.v3-canvas').focus();
  await page.keyboard.press('ArrowLeft');
  await page.locator('button', { hasText: 'Dach i sufit' }).click();
  check((await page.locator('button', { hasText: 'Dach i sufit' }).getAttribute('aria-pressed')) === 'false', '3D: roof toggle');
  // handle name and tab order
  await page.click('.surf[data-ref=R1]');
  check((await page.locator('[role=slider]').first().getAttribute('aria-label')).includes('przeciągnij'), 'start handle: specific accessible name');
  await ctx.close();
}

// ---------------- measurement panel (desktop 1280 and 1500, phone sheet)
{
  const { ctx, page } = await open({ width: 1280, height: 900 }, 1);
  await page.click('#tab-salon');
  const rail = page.locator('[data-panel-rail]');
  const rb = await rail.boundingBox();
  check(Math.abs(rb.width - 56) <= 1, `panel: the rail is 56 px wide (${rb.width})`);
  check((await rail.locator('button').allInnerTexts()).map((t) => t.replace(/\d+$/, '').trim()).join('|') === 'Wymiary|Punkty startu|Otwory|Płyty', 'panel: the rail has four labelled icons');
  check(await page.locator('#measure-panel').isHidden(), 'panel: closed by default');
  const frameBefore = await page.locator('main .overflow-hidden.rounded-lg').first().boundingBox();
  await rail.locator('[data-rail=dims]').click();
  const pb = await page.locator('#measure-panel').boundingBox();
  check(Math.abs(pb.width - 380) <= 1, `panel: opens as a 380 px panel (${pb.width})`);
  const frameAfter = await page.locator('main .overflow-hidden.rounded-lg').first().boundingBox();
  check(Math.abs(frameAfter.width - frameBefore.width) < 1, 'panel: overlays the drawing, it does not push it');
  check((await page.locator('#measure-panel').getAttribute('data-panel-state')) === 'overlay', 'panel: overlay mode at 1280 px');
  check((await page.locator('[data-count="Bryła"]').innerText()).startsWith('5/5'), 'panel: group completeness "Bryła 5/5"');
  // an emptied measurement is counted and can be jumped to
  await page.fill('#p_salon_dA', '');
  await page.locator('#p_salon_dA').blur();
  check((await page.locator('[data-count="Wycięcia"]').innerText()).startsWith('4/6') === false && (await page.locator('[data-count="Wycięcia"]').innerText()).includes('/'), 'panel: the group shows how many of its measurements are filled in');
  const missingLink = page.locator('#measure-panel p[role=status] button').first();
  check((await missingLink.count()) === 1, 'panel: the missing measurement is listed with a jump link');
  await page.locator('#p_salon_L').focus();
  await missingLink.click();
  await page.waitForTimeout(400);
  check((await page.evaluate(() => document.activeElement?.id)) === 'p_salon_dA', 'panel: the jump link focuses the missing field');
  check((await page.locator('[data-field=dA]').getAttribute('data-hl')) === 'true', 'panel: the field is highlighted');
  await page.fill('#p_salon_dA', '140');
  // a measurement tapped on the drawing: quick popup, with a way into the panel
  await page.keyboard.press('Escape');
  check(await page.locator('#measure-panel').isHidden(), 'panel: Esc closes');
  await page.locator('.meas').first().click();
  await page.locator('.meas-edit button', { hasText: 'Pokaż w panelu' }).click();
  await page.waitForTimeout(300);
  check((await page.locator('#measure-panel').isVisible()) && (await page.evaluate(() => !!document.activeElement?.id.startsWith('p_salon_'))), 'panel: "Pokaż w panelu" opens it at that measurement');
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
  await page.click('.surf[data-ref=R6]');
  check((await page.locator('#measure-panel-h').innerText()) === 'Otwory', 'panel: stays on the section while the selected surface changes');
  // remembered after a reload
  await page.reload();
  await page.waitForSelector('[role=tab]');
  check(await page.locator('#measure-panel').isVisible() && (await page.locator('#measure-panel-h').innerText()) === 'Otwory', 'panel: open state and section are remembered');
  if (shots) { await page.locator('[data-panel-rail] [data-rail=dims]').click(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(shots, 'panel-1280.png') }); }
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 1500, height: 900 }, 1);
  await page.click('#tab-salon');
  await page.locator('[data-panel-rail] [data-rail=dims]').click();
  await page.getByRole('button', { name: 'Przypnij panel' }).click();
  check((await page.locator('#measure-panel').getAttribute('data-panel-state')) === 'pinned', 'panel: can be pinned at 1500 px');
  const pinnedFrame = await page.locator('main .overflow-hidden.rounded-lg').first().boundingBox();
  const panelBox = await page.locator('#measure-panel').boundingBox();
  check(pinnedFrame.x + pinnedFrame.width <= panelBox.x + 1, 'panel: pinned beside the drawing, not over it');
  await page.keyboard.press('Escape');
  check(await page.locator('#measure-panel').isVisible(), 'panel: Esc does not close a pinned panel');
  await page.reload();
  await page.waitForSelector('[role=tab]');
  check((await page.locator('#measure-panel').getAttribute('data-panel-state')) === 'pinned', 'panel: the pin is remembered');
  await ctx.close();
}

// ---------------- phone
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 2);
  for (const id of ['salon', 'lazienka-2', 'rozkroj']) {
    await page.click(`#tab-${id}`);
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(over <= 0, `phone width: no horizontal page scroll on ${id} (overflow ${over}px)`);
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
    check((await strip.locator('button').count()) === 4 && (await page.locator('[data-panel-rail]').isHidden()), 'phone: the four sections are a strip, the rail is hidden');
    await strip.locator('[data-rail=dims]').click();
    await page.waitForSelector('[data-sheet-tab=dims][aria-selected=true]');
    const sb = await page.locator('[role=dialog]').last().boundingBox();
    check(sb.y > 844 * 0.1 && sb.y + sb.height >= 843, 'phone: the sections open as a bottom sheet');
    check((await page.locator('[role=dialog] #p_salon_W').count()) === 1, 'phone: the sheet holds the dimension fields');
    if (shots) { await page.waitForTimeout(300); await page.screenshot({ path: path.join(shots, 'panel-390.png') }); }
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role=dialog]', { state: 'detached' });
    check((await page.evaluate(() => document.activeElement?.getAttribute('data-rail'))) === 'dims', 'phone: Esc closes the sheet and returns the focus');
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
