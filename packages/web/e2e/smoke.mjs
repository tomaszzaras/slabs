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
  const ctx = await browser.newContext({ viewport, deviceScaleFactor });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('[role=tab]');
  return { ctx, page };
}
const stat = async (page, label) => page.locator('.stat', { hasText: label }).first().locator('b').innerText();

// ---------------- desktop
{
  const { ctx, page } = await open({ width: 1280, height: 1500 }, 2);
  check((await page.locator('[role=tab]').count()) === 5, 'five tabs: four rooms and the shared cut');
  for (const [id, name] of [['salon', 'Salon'], ['sypialnia', 'Sypialnia'], ['lazienka-1', 'Łazienka 1'], ['lazienka-2', 'Łazienka 2']]) {
    await page.click(`#tab-${id}`);
    await page.waitForSelector(`[data-room=${id}] h1`);
    check((await page.locator(`[data-room=${id}] h1`).innerText()) === name, `${id}: heading`);
    check((await page.locator('table tbody tr').count()) > 0, `${id}: reference table has rows`);
    check((await page.locator('.draw svg').count()) === 3, `${id}: plan, boards and gables drawn`);
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
    await row.locator('button').nth(1).click();
    check((await row.locator('input').inputValue()) === '5', `${id}: first start point shifted +5 with the step button`);
    await page.locator('.stepbar button', { hasText: 'Zeruj' }).click();
    check((await row.locator('input').inputValue()) === '0', `${id}: shifts reset`);
    // per-room cut
    await page.locator('button', { hasText: 'Generuj propozycję cięć' }).click();
    await page.waitForSelector('.sheets svg', { timeout: 30000 });
    const plates = await stat(page, 'płyt wg propozycji cięć');
    check(Number(plates) > 0, `${id}: cut proposal has ${plates} plates`);
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
  await page.locator('summary', { hasText: 'Ustawienia płyt' }).click();
  await page.locator('button', { hasText: 'Jak w pierwowzorze' }).click();
  check((await page.locator('.stat', { hasText: 'utracona w rzazie' }).count()) === 1, 'shared cut with the default 3 mm kerf reports the area lost in cuts');
  await page.click('#calc');
  await page.waitForFunction(() => !document.body.innerText.includes('utracona w rzazie') && !document.body.innerText.includes('od ostatniego obliczenia'), null, { timeout: 60000 });
  check((await stat(page, 'płyt razem')) === '35', 'artifact settings (kerf 0, no allowances) give the artifact result: 35 plates');
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
  await page.locator('button', { hasText: 'Generuj propozycję cięć' }).click();
  await page.waitForSelector('.sheets svg', { timeout: 30000 });
  await page.locator('#p_salon_L').fill('1010');
  check((await page.locator('.badge', { hasText: 'Nieaktualne – przelicz' }).count()) === 1, 'stale: label shown after an edit');
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
  await page.locator('button', { hasText: /Motyw/ }).click();
  await page.locator('button', { hasText: /Motyw/ }).click();
  const bg1 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg0 !== bg1, `theme toggle changes the background (${bg0} -> ${bg1})`);
  // share link round trip
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('button', { hasText: 'Kopiuj link' }).click();
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
  if (shots) { await page.click('#tab-salon'); await page.screenshot({ path: path.join(shots, 'phone-salon.png') }); }
  await ctx.close();
}

check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
