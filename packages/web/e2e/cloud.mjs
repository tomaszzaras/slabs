// Cloud-saving e2e: serves packages/web/dist plus the real /api/projects handler (bundled with esbuild, in-memory store
// instead of Netlify Blobs; `netlify dev` cannot run in the dev container). Run: pnpm build && pnpm e2e:cloud
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..', '..');
const dist = path.join(here, '..', 'dist');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slabs-e2e-'));
const out = path.join(tmp, 'api.mjs');
await esbuild.build({
  stdin: { contents: "export { handle } from './netlify/lib/projects-api.ts'; export { memoryStore } from './netlify/lib/memory-store.ts';", resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { handle, memoryStore } = await import(pathToFileURL(out).href);
const store = memoryStore();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await handle(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : body }), store);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let p = decodeURIComponent(u.pathname);
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
const newCtx = async () => {
  const ctx = await browser.newContext({ locale: 'pl-PL', viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  return ctx;
};
const openPage = async (ctx, url) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { // expected, handled responses: 409 (conflict) and 404 (unknown link) from /api/projects; offline mode
    if (m.type() !== 'error' || m.text().includes('ERR_INTERNET_DISCONNECTED')) return;
    if (m.location().url.includes('/api/projects') && /status of (409|404)/.test(m.text())) return;
    errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('[role=tab]');
  await page.click('#tab-salon');
  const rail = page.locator('[data-rail=dims]:visible').first(); // the dimension fields live in the measurement panel
  if ((await rail.getAttribute('aria-pressed')) !== 'true') await rail.click();
  return page;
};
const status = (page) => page.locator('[data-sync]');
const waitStatus = (page, text) => status(page).filter({ hasText: text }).waitFor({ timeout: 8000 }).then(() => true, () => false);
const field = (page) => page.locator('#p_salon_L');
const menu = async (page, name) => { await page.locator('button', { hasText: 'Menu' }).click(); await page.getByRole('menuitem', { name, exact: true }).click(); };

// 1. first visit creates a cloud project on the first edit; the URL becomes the project link
const ctx1 = await newCtx();
const page1 = await openPage(ctx1, base);
const L0 = Number(await field(page1).inputValue());
await field(page1).fill(String(L0 + 111));
check(await waitStatus(page1, 'Zapisano ✓'), 'status shows "Zapisano ✓" after an edit');
const link = page1.url();
check(/\?p=[A-Za-z0-9_-]{22,}$/.test(link), `URL is the project link (${link.replace(base, '')})`);
check(store.data.size === 1, 'exactly one project on the server');

// 2. reload keeps the edit (from the server)
await page1.reload(); await page1.waitForSelector('[role=tab]');
check(Number(await field(page1).inputValue()) === L0 + 111, 'reload: edit is still there');
check(page1.url() === link, 'reload: same link');

// 3. fresh browser context (no local storage at all) opens the link and sees the edit
const ctx2 = await newCtx();
const page2 = await openPage(ctx2, link);
check(Number(await field(page2).inputValue()) === L0 + 111, 'fresh browser context opens ?p= link and sees the edit');
check(await waitStatus(page2, 'Zapisano ✓'), 'second context: saved status');

// 4. copy-link action
await menu(page1, 'Kopiuj link do projektu');
check((await page1.evaluate(() => navigator.clipboard.readText())) === link, 'menu action copies the project link');
check((await page1.getByText('Każdy, kto ma ten link, może projekt oglądać i edytować').count()) > 0, 'copy shows the "anyone with the link can edit" note');

// 5. conflict: context 2 saves, context 1 (stale) saves later -> server copy is loaded, local copy offered back
await field(page2).fill(String(L0 + 222));
check(await waitStatus(page2, 'Zapisano ✓'), 'second context saved its edit');
await page2.waitForTimeout(1200);
await field(page1).fill(String(L0 + 333));
await page1.getByRole('button', { name: 'Kopia z tego urządzenia' }).waitFor({ timeout: 8000 });
check(Number(await field(page1).inputValue()) === L0 + 222, 'conflict: server copy loaded in the stale tab');
check((await page1.getByText('Ten projekt zmieniono w innym miejscu').count()) === 1, 'conflict: toast explains it, local copy offered as "Kopia z tego urządzenia"');
await page1.getByRole('button', { name: 'Kopia z tego urządzenia' }).click();
check(Number(await field(page1).inputValue()) === L0 + 333, 'restoring the local copy brings it back');
check(await waitStatus(page1, 'Zapisano ✓'), 'restored copy is saved');
await page2.reload(); await page2.waitForSelector('[role=tab]');
check(Number(await field(page2).inputValue()) === L0 + 333, 'other context sees the restored copy after reload');

// 6. offline: edit, see the offline status, come back online, it is saved
await ctx1.setOffline(true);
await field(page1).fill(String(L0 + 444));
check(await waitStatus(page1, 'Offline – zapiszę później'), 'offline status shown');
await ctx1.setOffline(false);
check(await waitStatus(page1, 'Zapisano ✓'), 'saved automatically after coming back online');
await page2.reload(); await page2.waitForSelector('[role=tab]');
check(Number(await field(page2).inputValue()) === L0 + 444, 'offline edit reached the server');

// 7. offline reload: the cached copy opens and the edit made while offline is kept and uploaded later
await ctx1.setOffline(true);
await page1.reload().catch(() => {});
await ctx1.setOffline(false);
await page1.goto(link); await page1.waitForSelector('[role=tab]');
check(Number(await field(page1).inputValue()) === L0 + 444, 'reopen: project loads');

// 8. a #p= share link is an import of a copy and becomes its own project
const shareLink = await (async () => {
  await menu(page1, 'Kopiuj link do kopii');
  return page1.evaluate(() => navigator.clipboard.readText());
})();
const ctx3 = await newCtx();
const page3 = await openPage(ctx3, base.slice(0, -1) + new URL(shareLink).pathname + new URL(shareLink).hash);
check(Number(await field(page3).inputValue()) === L0 + 444, 'share link still imports a copy');
const before = store.data.size;
await field(page3).fill(String(L0 + 555));
check(await waitStatus(page3, 'Zapisano ✓'), 'imported copy saved after first edit');
check(store.data.size === before + 1 && page3.url() !== link, 'the copy became a new project; the original is untouched');
await page1.reload(); await page1.waitForSelector('[role=tab]');
check(Number(await field(page1).inputValue()) === L0 + 444, 'original project unchanged');

// 9. migration: a project that only exists in this browser (saved before online saving existed) is uploaded on the first open
{
  const ctx = await newCtx();
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('seeded')) {
      localStorage.setItem('seeded', '1');
      localStorage.setItem('slabs:project:v1', JSON.stringify({ version: 1, id: 'legacy01', name: 'Stary projekt', updatedAt: 1, rooms: { salon: { on: true, params: { L: 777 } } } }));
    }
  });
  const before = store.data.size;
  const page = await openPage(ctx, base);
  check(await waitStatus(page, 'Zapisano ✓'), 'migration: local project uploaded on first open');
  check(Number(await field(page).inputValue()) === 777, 'migration: the local project is the one shown');
  check(store.data.size === before + 1 && [...store.data.values()].some((e) => e.data.name === 'Stary projekt' && e.data.rooms.salon.params.L === 777), 'migration: server holds the old local project');
  check(/\?p=/.test(page.url()), 'migration: URL became the project link');
  await ctx.close();
}

// 10. unknown link
const ctx4 = await newCtx();
const page4 = await openPage(ctx4, base + '?p=' + 'x'.repeat(30));
check((await page4.getByText('Nie ma takiego projektu online').count()) === 1, 'unknown link: clear message, app still usable');

// 11. single-file build: no server, quiet browser-only status (only when dist-single exists)
const single = path.join(here, '..', 'dist-single', 'index.html');
if (fs.existsSync(single)) {
  const ctx = await newCtx();
  const page = await openPage(ctx, pathToFileURL(single).href);
  check((await status(page).innerText()) === 'Zapis tylko w tej przeglądarce', 'single-file build: browser-only status');
  check((await page.getByRole('button', { name: 'Menu' }).count()) === 1, 'single-file build: app works');
  await ctx.close();
}

check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
