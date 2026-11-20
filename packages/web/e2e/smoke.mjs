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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('[role=tab]');
  return { ctx, page };
}
const stat = async (page, label) => page.locator('.stat', { hasText: label }).first().locator('b').innerText();

async function audit(page, label) {
  const r = await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('button, select, input:not([type=hidden]):not([type=checkbox]):not([type=file]), summary').forEach((el) => {
      if (el.closest('.skip') || el.classList.contains('skip')) return;
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
  for (const [id, name] of [['salon', 'Salon'], ['sypialnia', 'Sypialnia'], ['lazienka-1', 'Łazienka 1'], ['lazienka-2', 'Łazienka 2']]) {
    await page.click(`#tab-${id}`);
    await page.waitForSelector(`[data-room=${id}] h1`);
    check((await page.locator(`[data-room=${id}] h1`).innerText()) === name, `${id}: heading`);
    check((await page.locator('table tbody tr').count()) > 0, `${id}: reference table has rows`);
    check((await page.locator('.pan svg.mark').count()) === 1 && (await page.locator('.minimap svg').count()) === 1, `${id}: floor plan and the selected surface are drawn`);
    check((await page.locator('h1').count()) === 1, `${id}: exactly one h1`);
    const net0 = await stat(page, 'powierzchnia netto');
    // change a dimension: the area has to change
    const field = { salon: 'L', sypialnia: 'L', 'lazienka-1': 'L', 'lazienka-2': 'bz' }[id];
    const input = page.locator(`#p_${id}_${field}`);
    const old = await input.inputValue();
    await input.fill(String(Number(old) + 100));
    const net1 = await stat(page, 'powierzchnia netto');
    check(net0 !== net1, `${id}: net area changes with ${field} (${net0} -> ${net1})`);
    await input.fill(old);
    // shift controls move a start point
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
  if (shots) await page.screenshot({ path: path.join(shots, 'rozkroj.png') });
  // kerf 0 and no allowances: the artifact's numbers for the default project (35 plates, see docs/STATUS.md)
  await page.locator('summary', { hasText: 'Rzaz, obcięcie' }).first().click();
  await page.locator('button', { hasText: 'Jak w pierwowzorze' }).click();
  check((await page.locator('.stat', { hasText: 'utracona w rzazie' }).count()) === 1, 'shared cut with the default 3 mm kerf reports the area lost in cuts');
  await page.click('#calc');
  await page.waitForFunction(() => !document.body.innerText.includes('utracona w rzazie') && !document.querySelector('.total.stale') && !document.querySelector('.stale'), null, { timeout: 60000 });
  check((await stat(page, 'płyt razem')) === '35', 'artifact settings (kerf 0, no allowances) give the artifact result: 35 plates');
  // language switch: English strings, Polish decimal comma vs English decimal point
  await page.click('#tab-salon');
  await page.locator('button', { hasText: 'Menu' }).click();
  const netPl = await stat(page, 'powierzchnia netto');
  check(/^\d+,\d m²$/.test(netPl), `locale: Polish number format has a decimal comma (${netPl})`);
  await page.locator('.seg button', { hasText: 'EN' }).click();
  await page.keyboard.press('Escape');
  check((await page.locator('h1').first().innerText()).length > 0 && (await page.locator('[data-room=salon] h1').innerText()) === 'Living room', 'language: room name switches to English');
  const netEn = await stat(page, 'net area');
  check(/^\d+\.\d m²$/.test(netEn), `locale: English number format has a decimal point (${netEn})`);
  check((await page.evaluate(() => document.documentElement.lang)) === 'en', 'language: <html lang> follows');
  await page.locator('button', { hasText: 'Menu' }).click();
  await page.locator('.seg button', { hasText: 'PL' }).click();
  await page.keyboard.press('Escape');
  check((await page.locator('[data-room=salon] h1').innerText()) === 'Salon', 'language: back to Polish');
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
  check((await page.locator('#p_lazienka-2_hb').inputValue()) === '70', 'editor: a dimension typed on the drawing changes the room input');
  await page.keyboard.press('Escape');
  await page.click('#tab-salon');
  // inline validation: plain-words error with the field's real name, aria wiring, corrected on blur
  await page.click('#tab-salon');
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
  await page.locator('#toast-undo').click();
  check((await W.inputValue()) === '600', 'reset: the undo toast brings the dimensions back');
  await W.fill('548');
  // stale result stays visible, dimmed and labelled
  await page.locator('button', { hasText: 'Przelicz tylko to pomieszczenie' }).click();
  await page.waitForSelector('.sheets svg', { timeout: 30000 });
  await page.locator('#p_salon_L').fill('1010');
  check((await page.locator('.centre .badge', { hasText: 'Nieaktualne – przelicz' }).count()) === 1, 'stale: label shown after an edit');
  check((await page.locator('.sheets svg').count()) > 0, 'stale: the old plates stay visible');
  await page.locator('#p_salon_L').fill('980');
  // autosave survives a reload
  await page.click('#tab-salon');
  await page.locator('#p_salon_W').fill('600');
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForSelector('[role=tab]');
  await page.click('#tab-salon');
  check((await page.locator('#p_salon_W').inputValue()) === '600', 'autosave: value survives a reload');
  // dark mode
  const bg0 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.locator('button', { hasText: 'Menu' }).click();
  await page.locator('button', { hasText: /Motyw/ }).click();
  await page.locator('button', { hasText: /Motyw/ }).click();
  const bg1 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg0 !== bg1, `theme toggle changes the background (${bg0} -> ${bg1})`);
  // share link round trip
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('button', { hasText: 'Kopiuj link' }).click();
  await page.keyboard.press('Escape');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  check(link.includes('#p='), 'share link copied');
  const page2 = await ctx.newPage();
  await page2.goto(link);
  await page2.waitForSelector('[role=tab]');
  await page2.click('#tab-salon');
  check((await page2.locator('#p_salon_W').inputValue()) === '600', 'share link: opens the same project');
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
  await audit(page, 'phone salon');
  if (shots) await page.screenshot({ path: path.join(shots, 'phone-salon.png') });
  await ctx.close();
}

check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
