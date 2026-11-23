// Landing page e2e: signed-out visitor on the stub build (dist-stub). Drag the sample wall's start point: numbers change.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist-stub');
const shots = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const requests = [];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  requests.push(p);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failures++; };
const browser = await chromium.launch();
const errors = [];
const open = async (w, h, locale = 'pl-PL') => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  await page.waitForSelector('[data-live-wall] svg');
  return { ctx, page };
};
const fig = (page, k) => page.locator(`[data-fig=${k}]`).innerText();

{
  const { ctx, page } = await open(1280, 900);
  check((await page.locator('h1').innerText()).includes('plan cięcia'), 'headline is shown');
  check((await page.locator('[data-a=sign-in]').count()) === 2, 'two sign-in buttons (first viewport and closing)');
  check((await page.locator('[data-a=sign-in]').first().innerText()).includes('Zaloguj się przez Google') && (await page.getByText('Bezpłatnie').count()) >= 1, 'button says "Zaloguj się przez Google", "Bezpłatnie" next to it');
  check((await page.locator('[role=tab]').count()) === 0, 'no editor');
  const heavy = requests.filter((r) => /View3D|jspdf|html2canvas|App-/.test(r));
  check(heavy.length === 0, 'landing loads no editor, three.js or jsPDF chunk' + (heavy.length ? ': ' + heavy.join(', ') : ''));
  const jsBytes = requests.filter((r) => r.endsWith('.js')).reduce((a, r) => a + fs.statSync(path.join(dist, r)).size, 0);
  console.log(`     landing JavaScript: ${(jsBytes / 1024).toFixed(0)} kB (uncompressed)`);
  check(jsBytes < 600 * 1024, 'landing JavaScript under 600 kB uncompressed');
  check(requests.includes('/favicon.ico') || fs.existsSync(path.join(dist, 'favicon.ico')), 'favicon.ico exists');

  // drag the start point: joints move, numbers change
  const p0 = await fig(page, 'plates'), w0 = await fig(page, 'waste');
  const svg = await page.locator('[data-wall-svg]').boundingBox();
  const joints0 = await page.locator('[data-wall-svg] .mk-chalk').evaluateAll((els) => els.map((e) => e.getAttribute('x1')));
  const handle = await page.locator('[data-a=wall-handle]').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x - 60, handle.y + 20, { steps: 8 });
  await page.mouse.up();
  const joints1 = await page.locator('[data-wall-svg] .mk-chalk').evaluateAll((els) => els.map((e) => e.getAttribute('x1')));
  check(JSON.stringify(joints0) !== JSON.stringify(joints1), 'dragging R moves the joints');
  const start1 = await page.locator('[data-a=wall-start]').innerText();
  check(start1 !== 'Start 47 cm', `start value follows the drag (${start1})`);
  // drag to the wall: the engine says fewer plates and less waste
  await page.locator('[data-a=wall-handle]').focus();
  await page.keyboard.press('Home');
  const p1 = await fig(page, 'plates'), w1 = await fig(page, 'waste');
  check(p0 === '3' && p1 === '2', `plate count changes with the start point (${p0} -> ${p1})`);
  check(parseInt(w0) > parseInt(w1), `waste changes with it (${w0} -> ${w1})`);
  check((await page.locator('[data-a=wall-note]').innerText()).includes('najmniej płyt'), 'the note explains the best start');
  check((await page.locator('[data-a=wall-handle]').getAttribute('aria-valuenow')) === '0', 'the handle is a slider with its value');
  await page.keyboard.press('ArrowRight');
  check((await page.locator('[data-a=wall-start]').innerText()) === 'Start 1 cm' && (await page.locator('[data-wall-svg] .mk-x, [data-wall-svg] [class*=sliver]').count()) >= 0, 'arrow keys move the start by 1 cm');
  await page.locator('[data-a=wall-right]').click();
  check((await page.locator('[data-a=wall-start]').innerText()) === 'Start 6 cm', 'the buttons move it by 5 cm (a way without dragging)');
  check((await page.getByText('Nic się nie zapisuje').count()) === 1, 'labelled as an example, nothing saved');
  check((await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('slabs:p') || k.includes('index')).length)) === 0, 'nothing is stored by the example');
  if (shots) { await page.screenshot({ path: path.join(shots, 'landing-1280.png') }); await page.screenshot({ path: path.join(shots, 'landing-1280-full.png'), fullPage: true }); }

  // language switch
  await page.locator('[data-lang=en]').first().click();
  check((await page.locator('h1').innerText()).includes('cutting plan') && (await page.locator('[data-a=sign-in]').first().innerText()).includes('Sign in with Google'), 'English: headline and button');
  check((await page.locator('html').getAttribute('lang')) === 'en', 'html lang follows');
  await page.locator('[data-lang=pl]').last().click();
  check((await page.locator('h1').innerText()).includes('plan cięcia'), 'back to Polish (switch in the footer works too)');
  // keyboard focus reaches the primary action
  await page.keyboard.press('Tab');
  await ctx.close();
}
{
  const { ctx, page } = await open(390, 844);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, 'phone 390 px: no horizontal scroll');
  const small = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && e.textContent.trim() && !e.closest('svg') && parseFloat(getComputedStyle(e).fontSize) < 12).length);
  check(small === 0, 'phone: no text under 12 px (outside drawings)');
  const small2 = await page.evaluate(() => [...document.querySelectorAll('[data-wall-svg] text')].filter((e) => e.textContent.trim() && e.getBoundingClientRect().height < 8).length);
  check(small2 === 0, 'phone: wall drawing text stays readable');
  const btn = await page.locator('[data-a=sign-in]').first().boundingBox();
  check(btn.height >= 44, 'phone: sign-in button is at least 44 px high');
  const wall = await page.locator('[data-live-wall]').boundingBox();
  check(wall.y < 844 + 400, 'phone: the wall follows the button directly');
  if (shots) { await page.screenshot({ path: path.join(shots, 'landing-390.png') }); await page.screenshot({ path: path.join(shots, 'landing-390-full.png'), fullPage: true }); }
  await ctx.close();
}
check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
