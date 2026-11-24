// Account e2e: serves packages/web/dist-stub (the test build with a stub sign-in) plus the real /api/projects handler (bundled with
// esbuild, in-memory store instead of Upstash Redis, stub authenticator instead of Clerk). Run: pnpm build:stub && pnpm e2e:auth
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
const dist = path.join(here, '..', 'dist-stub');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slabs-e2e-'));
const out = path.join(tmp, 'api.mjs');
await esbuild.build({
  stdin: { contents: "export { handle } from './server/projects-api.ts'; export { memoryStore } from './server/memory-store.ts'; export { stubAuthenticator } from './server/auth.ts';", resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { handle, memoryStore, stubAuthenticator } = await import(pathToFileURL(out).href);
const apiCalls = [];
const store = memoryStore();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    apiCalls.push({ method: req.method, path: u.pathname, auth: req.headers.authorization ?? null });
    const r = await handle(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }), store, stubAuthenticator);
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
/** A browser profile; `user` = who is signed in there (the stub session lives in localStorage), null = signed out. */
const newCtx = async (user = null, { seed = null } = {}) => {
  const ctx = await browser.newContext({ locale: 'pl-PL', viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  if (user) await ctx.addInitScript((u) => { try { if (!localStorage.getItem('slabs-stub-off')) localStorage.setItem('slabs-stub-user', u); } catch { /* ignore */ } }, user);
  if (seed) await ctx.addInitScript((json) => { try { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('slabs:project:v1', json); } } catch { /* ignore */ } }, seed);
  return ctx;
};
const openPage = async (ctx, url, { room = true } = {}) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { // expected, handled responses: 409 (conflict), 403 (link off), 404 (unknown link) from /api/projects; offline mode
    if (m.type() !== 'error' || m.text().includes('ERR_INTERNET_DISCONNECTED')) return;
    if (m.location().url.includes('/api/projects') && /status of (401|403|404|409)/.test(m.text())) return;
    errors.push(m.text()); });
  await page.goto(url);
  if (!await page.waitForSelector('[role=tab]', { timeout: 15000 }).then(() => true, () => false)) return page; // signed out: the landing page has no tabs
  if (!room) return page; // an empty project has no room to open
  await page.click('#tab-salon');
  return page;
};
const status = (page) => page.locator('[data-sync]');
const waitStatus = (page, text) => status(page).filter({ hasText: text }).waitFor({ timeout: 8000 }).then(() => true, () => false);
const field = (page) => page.locator('#p_salon_l');
const menu = async (page, name) => { await page.locator('button', { hasText: 'Menu' }).click(); await page.getByRole('menuitem', { name, exact: true }).click(); };


const HOUSE = fs.readFileSync(path.join(here, '..', '..', '..', 'fixtures', 'projects', 'v1-default.slabs.json'), 'utf8');
const tab = (page) => page.waitForSelector('[role=tab]');
const toast = (page, text) => page.getByText(text).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
const claimAll = async (page) => { await page.locator('[data-a=claim-add]').click(); await page.locator('[data-testid=claim-dialog]').waitFor({ state: 'detached', timeout: 8000 }); };
const owned = (user) => [...store.data.values()].filter((e) => e.metadata.owner === user);
let L0 = 0;
/** a key of the app's IndexedDB store (idb-keyval) */
const idbGet = (page, k) => page.evaluate((key) => new Promise((resolve) => {
  const r = indexedDB.open('keyval-store');
  r.onerror = () => resolve(null);
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('keyval')) { resolve(null); return; }
    const q = db.transaction('keyval').objectStore('keyval').get(key);
    q.onsuccess = () => resolve(q.result ?? null);
    q.onerror = () => resolve(null);
  };
}), k);

// ---- 1. signed out: only the landing page, no project is requested; sign in opens the app ----------------------------------
{
  const ctx = await newCtx(null);
  const page = await openPage(ctx, base);
  await page.locator('[data-a=sign-in]').first().waitFor();
  check((await page.locator('[role=tab]').count()) === 0, 'signed out: no editor, no tabs');
  check(!apiCalls.some((c) => c.path.startsWith('/api/projects')), 'signed out: no /api/projects request at all');
  await page.locator('[data-a=sign-in]').first().click();
  await tab(page);
  check(apiCalls.some((c) => c.auth === 'Bearer test:e2e-user'), 'signed in: requests carry the session token');
  check((await page.locator('[data-a=sign-in]').count()) === 0, 'signed in: the landing page is gone');
  await page.locator('[data-a=sign-out]').click();
  await page.locator('[data-a=sign-in]').first().waitFor({ timeout: 8000 });
  check((await page.locator('[role=tab]').count()) === 0, 'sign out: back to the landing page');
  await ctx.close();
}

// ---- 2. first sign-in with a project from before login: "Dodaj do konta" ------------------------------------------------------
const ctxA1 = await newCtx('alice', { seed: HOUSE });
const pageA1 = await openPage(ctxA1, base, { room: false });
await pageA1.locator('[data-testid=claim-dialog]').waitFor({ timeout: 8000 });
check((await pageA1.locator('[data-claim]').count()) === 1 && await pageA1.locator('[data-claim]').getAttribute('data-state') === 'checked', 'claim: the browser project is offered, ticked');
check(owned('alice').length === 0, 'claim: nothing is uploaded before the user agrees');
await claimAll(pageA1);
check(owned('alice').length === 1, 'claim: the project is now in alice\'s account on the server');
check(((await idbGet(pageA1, 'slabs:index:v2')) ?? []).length === 0 && !(await pageA1.evaluate(() => localStorage.getItem('slabs:project:v1'))), 'claim: the old browser copy is removed once it is in the account');
await pageA1.reload(); await tab(pageA1);
check(((await idbGet(pageA1, 'slabs:u:alice:index:v2')) ?? []).length === 1, 'claim: the account keeps one browser copy of it (own keys)');
check((await pageA1.locator('[data-testid=claim-dialog]').count()) === 0, 'claim: asked only once');
await pageA1.click('#tab-salon');
L0 = Number(await field(pageA1).inputValue());
await field(pageA1).fill(String(L0 + 111));
check(await waitStatus(pageA1, 'Zapisano ✓'), 'status shows "Zapisano ✓" after an edit');
const link = pageA1.url();
check(/\?p=[A-Za-z0-9_-]{22,}$/.test(link), `URL is the project address (${link.replace(base, '')})`);
check(owned('alice').length === 1 && store.data.size === 1, 'exactly one project on the server');

// ---- 3. a second device of the same user sees the project; another user does not -------------------------------------------------
const ctxA2 = await newCtx('alice');
const pageA2 = await openPage(ctxA2, base);
check(Number(await field(pageA2).inputValue()) === L0 + 111, 'new device: alice\'s newest project comes from the server');
check(await waitStatus(pageA2, 'Zapisano ✓'), 'new device: saved status');
check((await pageA2.locator('[data-testid=claim-dialog]').count()) === 0, 'new device: nothing to claim');
const ctxB0 = await newCtx('bob');
const pageB0 = await openPage(ctxB0, base, { room: false });
check((await pageB0.locator('[data-testid=claim-dialog]').count()) === 0, 'bob: sees none of alice\'s projects');
check(owned('bob').length === 0, 'bob: nothing created without an edit');
await pageB0.goto(link); await tab(pageB0);
check(await toast(pageB0, 'Nie masz dostępu do tego projektu'), 'bob opens alice\'s plain project link: no access, clear message');
check((await pageB0.locator('#tab-salon').count()) === 0, 'bob: alice\'s project is not shown');

// ---- 4. offline cache is per user; conflict between two tabs of one user ------------------------------------------------------
const cacheKeys = (page) => page.evaluate(() => Object.keys(localStorage).concat(['x']).filter((k) => k.startsWith('slabs:')));
check((await cacheKeys(pageA1)).some((k) => k.startsWith('slabs:u:alice:')), 'the browser copy is stored under the user\'s own keys');
{ // one browser, two people: the second one sees nothing of the first one's browser copy
  const ctx = await newCtx(null);
  const page = await openPage(ctx, base, { room: false });
  await page.evaluate(() => localStorage.setItem('slabs-stub-user', 'alice')); await page.reload(); await tab(page);
  await page.click('#tab-salon');
  await page.evaluate(() => localStorage.setItem('slabs-stub-user', 'bob')); await page.reload(); await tab(page);
  check((await page.locator('#tab-salon').count()) === 0 && (await page.locator('[role=tab]').count()) === 1, 'same browser, other user: none of the first user\'s projects (a new empty project)');
  check(!(await page.evaluate(() => document.body.innerText)).includes('(kopia)'), 'same browser, other user: no project names of the first user');
  await page.evaluate(() => localStorage.setItem('slabs-stub-user', 'alice')); await page.reload(); await tab(page);
  check((await page.locator('#tab-salon').count()) === 1, 'same browser, first user again: own project is back');
  await ctx.close();
}
await field(pageA2).fill(String(L0 + 222));
check(await waitStatus(pageA2, 'Zapisano ✓'), 'second device saved its edit');
await pageA2.waitForTimeout(1200);
await field(pageA1).fill(String(L0 + 333));
await pageA1.getByRole('button', { name: 'Kopia z tego urządzenia' }).waitFor({ timeout: 8000 });
check(Number(await field(pageA1).inputValue()) === L0 + 222, 'conflict: server copy loaded in the stale tab');
check((await pageA1.getByText('Ten projekt zmieniono w innym miejscu').count()) === 1, 'conflict: toast explains it, local copy offered');
await pageA1.getByRole('button', { name: 'Kopia z tego urządzenia' }).click();
check(Number(await field(pageA1).inputValue()) === L0 + 333, 'restoring the local copy brings it back');
check(await waitStatus(pageA1, 'Zapisano ✓'), 'restored copy is saved');
await pageA2.reload(); await tab(pageA2); await pageA2.click('#tab-salon');
check(Number(await field(pageA2).inputValue()) === L0 + 333, 'other device sees the restored copy after reload');

await ctxA1.setOffline(true);
await field(pageA1).fill(String(L0 + 444));
check(await waitStatus(pageA1, 'Offline – zapiszę później'), 'offline status shown');
await ctxA1.setOffline(false);
check(await waitStatus(pageA1, 'Zapisano ✓'), 'saved automatically after coming back online');
await pageA2.reload(); await tab(pageA2); await pageA2.click('#tab-salon');
check(Number(await field(pageA2).inputValue()) === L0 + 444, 'offline edit reached the server');

// ---- 5. sharing: view link, edit link, owner-only actions ------------------------------------------------------------------------
await pageA1.locator('button', { hasText: 'Menu' }).click();
await pageA1.getByRole('menuitem', { name: 'Udostępnij…', exact: true }).click();
const dlg = pageA1.locator('[data-testid=share-dialog]');
await dlg.waitFor();
check((await dlg.locator('[data-link=view][data-on=false]').count()) === 1 && (await dlg.locator('[data-link=edit][data-on=false]').count()) === 1, 'sharing: both links are off by default');
await dlg.locator('[data-a=view-on]').click();
await dlg.locator('[data-link=view][data-on=true]').waitFor();
const viewUrl = await dlg.locator('[data-a=view-url]').inputValue();
await dlg.locator('[data-a=edit-on]').click();
await dlg.locator('[data-link=edit][data-on=true]').waitFor();
const editUrl = await dlg.locator('[data-a=edit-url]').inputValue();
check(/\?p=.+&k=.+/.test(viewUrl) && /\?p=.+&k=.+/.test(editUrl) && viewUrl !== editUrl, 'sharing: two different links with project and key');
await dlg.locator('[data-a=view-copy]').click();
check((await pageA1.evaluate(() => navigator.clipboard.readText())) === viewUrl, 'sharing: copy puts the view link on the clipboard');
if (process.env.SHOTS) { await pageA1.screenshot({ path: path.join(process.env.SHOTS, 'sharing-dialog.png') }); }
await dlg.getByRole('button', { name: 'Gotowe' }).click();

// bob (signed in) opens the view link
const ctxB = await newCtx('bob');
const pageB = await openPage(ctxB, viewUrl, { room: false });
await pageB.locator('[data-access=view]').waitFor({ timeout: 8000 });
check((await pageB.locator('[data-access=view]').innerText()).includes('tylko do odczytu'), 'view link: banner text');
if (process.env.SHOTS) { await pageB.screenshot({ path: path.join(process.env.SHOTS, 'readonly-banner.png') }); }
await pageB.click('#tab-salon');
check((await field(pageB).getAttribute('readonly')) !== null, 'view link: measurement fields are read-only');
const before = Number(await field(pageB).inputValue());
await field(pageB).fill('999', { force: true }).catch(() => {});
await pageB.waitForTimeout(1500);
check(Number(await field(pageB).inputValue()) === before && owned('alice')[0].data.rooms.salon.spec.l !== 999, 'view link: typing changes nothing, on screen or on the server');
check((await pageB.locator('[data-sync=readonly]').count()) === 1, 'view link: status says read-only');
check((await pageB.getByRole('button', { name: 'Zmień nazwę projektu' }).count()) === 0, 'view link: no rename');
check(await pageB.locator('#undo').isDisabled() && await pageB.locator('[data-add-tab]').isDisabled(), 'view link: undo and add room are off');
await pageB.locator('button', { hasText: 'Menu' }).click();
check((await pageB.getByRole('menuitem', { name: 'Udostępnij…', exact: true }).count()) === 0 && (await pageB.getByRole('menuitem', { name: 'Usuń projekt' }).count()) === 0, 'view link: no sharing, no delete');
check((await pageB.getByRole('menuitem', { name: 'Eksport pliku' }).isEnabled()), 'view link: export stays available');
await pageB.keyboard.press('Escape');
check(owned('bob').length === 0 && store.data.size === 1, 'view link: nothing was copied to bob\'s account');
// a copy of it is bob's own
await pageB.locator('[data-a=copy-mine]').click();
await toast(pageB, 'Kopia jest już na Twoim koncie');
check(owned('bob').length === 1 && owned('bob')[0].data.name.endsWith('(kopia)'), 'view link: "Zrób własną kopię" puts a copy into bob\'s account');
check((await pageB.locator('[data-access]').count()) === 0, 'copy: the banner is gone, bob owns it');
await ctxB.close();

// edit link
const ctxB2 = await newCtx('bob');
const pageB2 = await openPage(ctxB2, editUrl, { room: false });
await pageB2.locator('[data-access=edit]').waitFor({ timeout: 8000 });
await pageB2.click('#tab-salon');
check((await pageB2.getByRole('button', { name: 'Zmień nazwę projektu' }).count()) === 0, 'edit link: no rename');
await pageB2.locator('button', { hasText: 'Menu' }).click();
check((await pageB2.getByRole('menuitem', { name: 'Udostępnij…', exact: true }).count()) === 0 && (await pageB2.getByRole('menuitem', { name: 'Usuń projekt' }).count()) === 0, 'edit link: no sharing, no delete');
await pageB2.keyboard.press('Escape');
await field(pageB2).fill(String(L0 + 555));
check(await waitStatus(pageB2, 'Zapisano ✓'), 'edit link: bob\'s edit is saved');
check(pageB2.url().includes('k='), 'edit link: the address keeps the key');
check((await cacheKeys(pageB2)).every((k) => !/shared/.test(k)), 'edit link: nothing about it stored in bob\'s browser');
await pageA1.reload(); await tab(pageA1); await pageA1.click('#tab-salon');
check(Number(await field(pageA1).inputValue()) === L0 + 555, 'edit link: alice sees bob\'s edit');
await ctxB2.close();

// regenerate / turn off
await pageA1.locator('button', { hasText: 'Menu' }).click();
await pageA1.getByRole('menuitem', { name: 'Udostępnij…', exact: true }).click();
await dlg.waitFor();
pageA1.once('dialog', (d) => d.accept());
await dlg.locator('[data-a=view-regen]').click();
await dlg.locator('[data-a=view-copy]').waitFor();
await pageA1.waitForTimeout(500);
const viewUrl2 = await dlg.locator('[data-a=view-url]').inputValue();
check(viewUrl2 !== viewUrl, 'regenerate: the view link is new');
await dlg.locator('[data-a=edit-off]').click();
await dlg.locator('[data-link=edit][data-on=false]').waitFor();
await dlg.getByRole('button', { name: 'Gotowe' }).click();
const ctxB3 = await newCtx('bob');
const pageB3 = await openPage(ctxB3, viewUrl, { room: false });
check(await toast(pageB3, 'Nie masz dostępu do tego projektu'), 'regenerate: the old view link no longer works');
const pageB4 = await openPage(ctxB3, editUrl, { room: false });
check(await toast(pageB4, 'Nie masz dostępu do tego projektu'), 'turned off: the edit link no longer works');
const pageB5 = await openPage(ctxB3, viewUrl2, { room: false });
check((await pageB5.locator('[data-access=view]').count()) === 1, 'the new view link works');
await ctxB3.close();

// a signed-out visitor with a share link sees the landing page; after signing in the link opens
{
  const ctx = await newCtx(null);
  const page = await openPage(ctx, viewUrl2, { room: false });
  await page.locator('[data-a=sign-in]').first().waitFor();
  check((await page.locator('[role=tab]').count()) === 0, 'signed out with a share link: landing only');
  await page.locator('[data-a=sign-in]').first().click();
  await page.locator('[data-access=view]').waitFor({ timeout: 8000 });
  check(page.url().includes('k='), 'after signing in the share link opens (address kept)');
  await ctx.close();
}

// ---- 6. an old link-only project (before login): the first signed-in user who opens it with its link can claim it ---------------
{
  const legacyId = 'LEGACY' + 'x'.repeat(26);
  const old = JSON.parse(HOUSE); old.name = 'Stary projekt online'; old.id = 'legacy-local';
  store.data.set(legacyId, { data: old, etag: '"old"', metadata: { revision: 5, updatedAt: 77 } });
  const ctx = await newCtx('carol');
  const page = await openPage(ctx, base + '?p=' + legacyId, { room: false });
  await page.locator('[data-testid=claim-dialog]').waitFor({ timeout: 8000 });
  check((await page.locator('[data-testid=claim-dialog]').innerText()).includes('Stary projekt online'), 'old link: the project is offered with "Dodaj do konta"');
  check(store.data.get(legacyId).metadata.owner === undefined, 'old link: still nobody\'s until carol agrees');
  await claimAll(page);
  check(store.data.get(legacyId).metadata.owner === 'carol', 'old link: now owned by carol');
  check(await page.waitForFunction(() => document.body.innerText.includes('Stary projekt online'), null, { timeout: 8000 }).then(() => true, () => false), 'old link: the project opens after it was added');
  // somebody else with the same old link gets nothing
  const ctxD = await newCtx('dave');
  const pageD = await openPage(ctxD, base + '?p=' + legacyId, { room: false });
  check(await toast(pageD, 'Nie masz dostępu do tego projektu'), 'old link after claim: another user gets no access');
  check((await pageD.locator('[data-testid=claim-dialog]').count()) === 0, 'old link after claim: no claim offered to another user');
  await ctxD.close();
  await ctx.close();
}

// ---- 7. a #p= share link still imports a copy; unknown link; delete is the owner's ---------------------------------------------
{
  await pageA1.locator('button', { hasText: 'Menu' }).click();
  await pageA1.getByRole('menuitem', { name: 'Kopiuj link do kopii', exact: true }).click();
  const shareLink = await pageA1.evaluate(() => navigator.clipboard.readText());
  const ctx = await newCtx('erin');
  const page = await openPage(ctx, base.slice(0, -1) + new URL(shareLink).pathname + new URL(shareLink).hash);
  check(Number(await field(page).inputValue()) === L0 + 555, 'share link still imports a copy');
  const n = store.data.size;
  await field(page).fill(String(L0 + 666));
  check(await waitStatus(page, 'Zapisano ✓'), 'imported copy saved after first edit');
  check(store.data.size === n + 1 && owned('erin').length === 1, 'the copy became erin\'s own new project');
  const unknown = await openPage(ctx, base + '?p=' + 'x'.repeat(30), { room: false });
  check(await toast(unknown, 'Nie ma takiego projektu online'), 'unknown link: clear message, app still usable');
  // delete
  const own = owned('erin')[0];
  const ownId = [...store.data.entries()].find(([, e]) => e === own)[0];
  const p2 = await openPage(ctx, base + '?p=' + ownId, { room: false });
  await p2.locator('button', { hasText: 'Menu' }).click();
  check((await p2.getByRole('menuitem', { name: 'Usuń projekt' }).count()) === 0, 'delete is offered only when the user has another project');
  await p2.keyboard.press('Escape');
  await ctx.close();
}
{
  const own = owned('bob')[0];
  const ownId = [...store.data.entries()].find(([, e]) => e === own)[0];
  const ctx = await newCtx('bob');
  const page = await openPage(ctx, base + '?p=' + ownId, { room: false });
  await page.locator('button', { hasText: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Otwórz przykład: dom z poddaszem' }).click(); // a second project, so the first can be deleted
  await page.waitForTimeout(800);
  await page.getByRole('combobox', { name: 'Projekt' }).click();
  await page.getByRole('option', { name: own.data.name }).click();
  await page.waitForFunction((n) => document.body.innerText.includes(n), own.data.name);
  await page.locator('button', { hasText: 'Menu' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('menuitem', { name: 'Usuń projekt' }).click();
  await page.waitForTimeout(1500);
  check(!store.data.has(ownId), 'owner deletes a project: gone from the server');
  check(!store.users.get('bob')?.has(ownId), 'owner deletes a project: gone from the index');
  await ctx.close();
}

// ---- 8. single-file build: no login, no server, quiet browser-only status (only when dist-single exists) ----------------------
const single = path.join(here, '..', 'dist-single', 'index.html');
if (fs.existsSync(single)) {
  const ctx = await newCtx(null);
  const page = await openPage(ctx, pathToFileURL(single).href, { room: false });
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
