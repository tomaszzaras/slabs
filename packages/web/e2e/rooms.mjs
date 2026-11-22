// Playwright: projects with any number of rooms (empty project, add-room flow, room menu, house roof). Serves packages/web/dist.
//   pnpm build && node packages/web/e2e/rooms.mjs      (SHOTS=docs/screenshots also saves screenshots)
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
const tabs = (page) => page.locator('[role=tab]').allInnerTexts();

async function open(viewport, deviceScaleFactor = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, locale: 'pl-PL' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('/api/projects')) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('[role=tab]');
  return { ctx, page };
}
/** "+ Dodaj pomieszczenie" -> template -> name -> create */
async function addRoom(page, template, name, side) {
  await page.locator('[data-add-tab]').click();
  await page.locator(`[data-template=${template}]`).click();
  await page.locator('#new-room-name').fill(name);
  if (side) await page.locator(`[data-side=${side}]`).click();
  await page.locator('[data-a=create-room]').click();
  await page.locator('[data-testid=add-room]').waitFor({ state: 'detached' });
}
// the measurement panel is remembered (open once a room was added with its first measurement focused): open it only if it is closed
const dims = async () => {}; // Kształt is part of the page now
const focused = (page, id) => page.waitForFunction((x) => document.activeElement?.id === x, id, { timeout: 5000 }).then(() => true, () => false);
async function audit(page, label) {
  const r = await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('button, select, input:not([type=hidden]):not([type=checkbox]):not([type=file]), summary, a[href]').forEach((el) => {
      if (el.getAttribute('role') === 'checkbox' || el.classList.contains('sr-only')) return;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return;
      if (b.height < 43.5 || b.width < 43.5) small.push(((el.id || el.textContent || el.tagName) + '').trim().slice(0, 24) + ` ${Math.round(b.width)}x${Math.round(b.height)}`);
    });
    return { small, scrollX: document.documentElement.scrollWidth - window.innerWidth };
  });
  check(r.small.length === 0, `${label}: every control is at least 44 px${r.small.length ? ' (' + r.small.slice(0, 4).join(', ') + ')' : ''}`);
  check(r.scrollX <= 1, `${label}: no horizontal page scroll`);
}

// ---------------- desktop
{
  const { ctx, page } = await open({ width: 1280, height: 1100 }, 2);
  check((await tabs(page)).join('|') === 'Przegląd', 'a new project has only Przegląd');
  check(await page.locator('[data-testid=empty-project]').isVisible(), 'empty project: the overview explains the flow');
  check((await page.locator('[data-testid=empty-project] ol li').count()) === 3, 'empty project: three steps (plate, room, result)');
  check((await page.locator('[data-room=przeglad] h1').innerText()) === 'Przegląd projektu', 'empty project: one h1');
  check((await page.locator('[data-testid=house-roof]').count()) === 1, 'Dach domu is in the project settings, also while the project is empty');
  if (shots) await page.screenshot({ path: path.join(shots, 'rooms-empty-1280.png'), fullPage: true });

  // the template picker
  await page.locator('[data-a=add-room-main]').click();
  check((await page.locator('[data-template]').count()) === 6, 'picker: six templates (presets of the generic room, and the band)');
  check((await page.locator('[data-template] svg').count()) === 6, 'picker: a small section drawing for each');
  check((await page.locator('[data-template=under-roof]').innerText()).includes('Pod dachem'), 'picker: name and one line for a template');
  if (shots) await page.screenshot({ path: path.join(shots, 'rooms-picker-1280.png') });
  await page.keyboard.press('Escape');
  check((await page.locator('[data-testid=add-room]').count()) === 0, 'picker: Escape closes it');

  // add: pod dachem, named; the room opens with its first measurement focused
  await addRoom(page, 'under-roof', 'Poddasze');
  check((await tabs(page)).join('|') === 'Przegląd|Poddasze', 'new room: its tab, after Przegląd');
  check((await page.locator('#tab-r1').getAttribute('aria-selected')) === 'true', 'new room: opens on its page');
  check(await focused(page, 'p_r1_l'), 'new room: the first measurement (length) is focused');
  check((await page.locator('[data-grey=W]').count()) === 1, 'room under the roof: the width says it comes from the house roof');
  // same template twice, then a sloped one from the right and a flat one
  await addRoom(page, 'under-roof', 'Poddasze');
  await addRoom(page, 'sloped', 'Łazienka', 'right');
  await addRoom(page, 'flat', '');
  const t = await tabs(page);
  check(t.join('|') === 'Przegląd|Poddasze|Poddasze|Łazienka|Pomieszczenie 1', 'rooms of one type can exist several times; no name: "Pomieszczenie n" (first unused n): ' + t.join('|'));
  check(await focused(page, 'p_r4_w'), 'flat template: the width of the room is focused');

  // Przegląd: totals, list, empty state gone
  await page.click('#tab-przeglad');
  await page.waitForSelector('[data-testid=items-table] [data-item]');
  check((await page.locator('[data-testid=items-table] [data-item]').count()) === 4, 'overview: a row for every room');
  check(!(await page.locator('[data-testid=empty-project]').count()), 'overview: no empty state once there are rooms');
  check((await page.locator('[data-item=r3]').innerText()).includes('Pod skosem, od prawej ściany'), 'overview: the room type is written under the name');
  await page.waitForSelector('[data-testid=project-total]', { timeout: 60000 });
  check(true, 'overview: the project total is calculated for the new rooms');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.locator('button', { hasText: 'Pobierz PDF' }).click()]);
  const pdf = fs.readFileSync(await dl.path());
  check(pdf.subarray(0, 4).toString() === '%PDF', 'cutting sheets (PDF) work with rooms of the same type');
  const prefixes = await page.locator('.sheets svg text').evaluateAll((els) => els.map((e) => e.textContent ?? ''));
  check(new Set(prefixes.map((x) => x.match(/^[^\d\s]+/)?.[0]).filter((x) => x && x.length <= 3)).size >= 3, 'plate drawings: the pieces of different rooms carry different room prefixes');

  // Dach domu
  await page.locator('#roof_W').fill('600');
  await page.locator('#roof_ang').fill('35');
  await page.locator('#roof_HL').fill('90');
  check((await page.locator('[data-testid=house-roof] svg').getAttribute('aria-label')).includes('600'), 'Dach domu: the section drawing follows the numbers');
  check((await page.locator('#roof_ridge').innerText()).includes('300'), 'Dach domu: the ridge is in the middle');
  if (shots) { await page.locator('[data-testid=house-roof]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shots, 'rooms-overview-1280.png'), fullPage: true }); }
  await page.click('#tab-r1');
  await dims(page);
  await page.waitForSelector('[data-grey=W]');
  check((await page.locator('[data-grey=W]').innerText()).includes('600') && (await page.locator('[data-grey=ang]').innerText()).includes('35'), 'the room under the roof shows the project roof (greyed)');
  // override one value, mark, reset
  await page.locator('[data-change-roof=ang]').click();
  await page.locator('#p_r1_ang').fill('30');
  await page.waitForSelector('[data-own=ang]');
  check((await page.locator('[data-reset-roof=ang]').innerText()).includes('35'), 'a changed roof value is marked and the reset names the project value');
  await page.locator('[data-reset-roof=ang]').click();
  check((await page.locator('[data-grey=ang]').innerText()).includes('35') && (await page.locator('[data-own=ang]').count()) === 0, 'reset to the project value');
  await page.locator('[data-change-roof=ang]').click();
  await page.locator('#p_r1_ang').fill('30');
  await page.click('#tab-przeglad');
  await page.locator('#roof_ang').fill('38');
  check((await page.locator('[data-testid=roof-overrides]').innerText()).includes('1 pomieszczenie'), 'Dach domu: says how many rooms have their own roof');
  await page.click('#tab-r1');
  check((await page.locator('#p_r1_ang').inputValue()) === '30', 'a changed value stays when the project roof changes');
  await page.click('#tab-r2');
  check((await page.locator('[data-grey=ang]').innerText()).includes('38'), 'a room that follows the roof takes the new project value');
  await page.keyboard.press('Escape');

  // room menu: duplicate, move, switch off, delete with undo
  await page.click('#tab-r1');
  await page.locator('[data-room-menu=r1]').click();
  await page.locator('[data-a=room-duplicate]').click();
  await page.waitForSelector('#tab-r5');
  const t2 = (await tabs(page)).join('|');
  check(t2 === 'Przegląd|Poddasze|Poddasze (kopia)|Poddasze|Łazienka|Pomieszczenie 1', 'duplicate: the copy sits right after the original, named "(kopia)": ' + t2);
  check((await page.locator('#tab-r5').getAttribute('aria-selected')) === 'true', 'duplicate: opens the copy');
  await page.locator('[data-room-menu=r5]').click();
  await page.locator('[data-a=room-right]').click();
  const t3 = (await tabs(page)).join('|');
  check(t3 === 'Przegląd|Poddasze|Poddasze|Poddasze (kopia)|Łazienka|Pomieszczenie 1', 'menu: move right: ' + t3);
  await page.locator('[data-room-menu=r5]').click();
  await page.locator('[data-a=room-left]').click();
  await page.locator('[data-room-menu=r5]').click();
  await page.locator('[data-a=room-toggle]').click();
  await page.click('#tab-przeglad');
  check((await page.locator('[data-item=r5]').innerText()).includes('wyłączone'), 'menu: leave out of the calculation shows on the overview');
  // reorder on the overview
  await page.locator('[data-item=r5] [data-a=down]').click();
  check((await page.locator('[data-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-item')))).join() === 'r1,r2,r5,r3,r4', 'overview: the arrows reorder the list');
  // delete: this room has data (a changed angle) -> asks first
  page.once('dialog', (d) => { check(d.message().includes('ma wpisane dane'), 'delete: a room with entered data asks first'); void d.dismiss(); });
  await page.locator('[data-item=r1] [data-room-menu]').click();
  await page.locator('[data-a=room-remove]').click();
  await page.waitForTimeout(300);
  check((await page.locator('[data-item=r1]').count()) === 1, 'delete: "cancel" keeps the room');
  page.once('dialog', (d) => { void d.accept(); });
  await page.locator('[data-item=r1] [data-room-menu]').click();
  await page.locator('[data-a=room-remove]').click();
  await page.waitForSelector('[data-item=r1]', { state: 'detached' });
  check(true, 'delete: confirmed, the room is gone');
  check((await page.getByText('Usunięto pomieszczenie').count()) > 0, 'delete: toast with undo');
  await page.locator('#undo').click();
  await page.waitForSelector('[data-item=r1]');
  check(true, 'delete: undo brings the room back');
  // a room without data is deleted without asking
  let asked = false;
  page.on('dialog', (d) => { asked = true; void d.dismiss(); });
  await page.locator('[data-item=r4] [data-room-menu]').click();
  await page.locator('[data-a=room-remove]').click();
  await page.waitForSelector('[data-item=r4]', { state: 'detached' });
  check(!asked, 'delete: a room that was not touched goes without asking');
  await audit(page, 'overview (1280)');
  if (shots) { // the owner's house as an example (four rooms in the list)
    await page.locator('button', { hasText: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Otwórz przykład: dom z poddaszem' }).click();
    await page.waitForSelector('[data-item=salon]');
    await page.waitForSelector('[data-testid=project-total]', { timeout: 60000 });
    await page.screenshot({ path: path.join(shots, 'rooms-example-1280.png'), fullPage: true });
  }
  await ctx.close();
}

// ---------------- the same on a phone
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 2);
  check(await page.locator('[data-testid=empty-project]').isVisible(), 'phone: empty project explains the flow');
  await page.locator('[data-a=add-room-main]').click();
  if (shots) await page.screenshot({ path: path.join(shots, 'rooms-picker-390.png') });
  await page.locator('[data-template=flat]').click();
  await page.locator('#new-room-name').fill('Łazienka');
  await page.locator('[data-a=create-room]').click();
  await page.locator('[data-testid=add-room]').waitFor({ state: 'detached' });
  check((await page.locator('#tab-r1').getAttribute('aria-selected')) === 'true', 'phone: the room is added and open');
  check(await focused(page, 'p_r1_w'), 'phone: its first measurement (Kształt) is focused');
  await page.keyboard.press('Escape');
  await page.locator('[data-room-menu=r1]').click();
  await page.locator('[data-a=room-rename]').click();
  await page.locator('[data-inline-name=edit] input').fill('Łazienka dolna');
  await page.keyboard.press('Enter');
  check((await page.locator('#tab-r1').innerText()) === 'Łazienka dolna', 'phone: rename from the room menu');
  await page.keyboard.press('Escape');
  await page.click('#tab-przeglad');
  await page.waitForSelector('[data-item=r1]');
  if (shots) await page.screenshot({ path: path.join(shots, 'rooms-overview-390.png'), fullPage: true });
  await audit(page, 'phone overview');
  await page.locator('[data-room-menu=r1]').click();
  await page.locator('[data-a=room-duplicate]').click();
  await page.waitForSelector('#tab-r2');
  check((await tabs(page)).join('|') === 'Przegląd|Łazienka dolna|Łazienka dolna (kopia)', 'phone: duplicate');
  await audit(page, 'phone room');
  await ctx.close();
}

check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
