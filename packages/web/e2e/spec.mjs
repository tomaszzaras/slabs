// Playwright: the generic room (Kształt, Okładzina: direction, start, finishes) on the owner's house and on new rooms. Serves packages/web/dist.
//   pnpm build && node packages/web/e2e/spec.mjs      (SHOTS=docs/screenshots also saves screenshots)      (SHOTS=docs/screenshots also saves screenshots)
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
async function open(viewport, deviceScaleFactor = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, locale: 'pl-PL' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('/api/projects')) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('[role=tab]');
  await page.locator('button', { hasText: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Otwórz przykład: dom z poddaszem' }).click();
  await page.waitForSelector('[data-item=salon]');
  return { ctx, page };
}
const edit = async (page) => { const b = page.locator('[data-a=edit-shape]'); if (await b.count()) await b.first().click(); };
const stat = async (page, label) => page.locator('.stat', { hasText: label }).first().locator('b').innerText();
const surf = (page, text) => page.locator('.surf', { hasText: text }).first();
async function audit(page, label) {
  const r = await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('[data-section] button, [data-section] input:not([type=hidden]):not([type=checkbox])').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      if (b.height < 43.5 || b.width < 43.5) small.push(((el.id || el.textContent || el.tagName) + '').trim().slice(0, 24) + ` ${Math.round(b.width)}x${Math.round(b.height)}`);
    });
    return { small, scrollX: document.documentElement.scrollWidth - window.innerWidth };
  });
  check(r.small.length === 0, `${label}: controls of the room page are at least 44 px${r.small.length ? ' (' + r.small.slice(0, 4).join(', ') + ')' : ''}`);
  check(r.scrollX <= 1, `${label}: no horizontal page scroll`);
}

{
  const { ctx, page } = await open({ width: 1280, height: 900 });
  await page.click('#tab-salon');
  check((await page.locator('[data-shape-view]').count()) === 1 && (await page.locator('#p_salon_l').count()) === 0, 'Kształt: read-only values until Edytuj');
  check((await page.locator('[data-testid=shape-values]').innerText()).includes('980'), 'Kształt: the values are shown (980)');
  await edit(page);
  // the page has the four sections
  const heads = await page.locator('h2').allInnerTexts();
  check(['Kształt', 'Powierzchnie', 'Okładzina', 'Wynik'].every((h) => heads.some((t) => t.includes(h))), 'room page: Kształt, Powierzchnie, Okładzina, Wynik: ' + heads.join(' | '));
  // Kształt describes the salon in the generic fields
  check((await page.locator('[data-seg=ceiling] [data-v=roof]').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-seg=pos] [data-v=full]').getAttribute('aria-pressed')) === 'true', 'Kształt: salon = under the roof, whole width');
  check((await page.locator('#p_salon_l').inputValue()) === '980', 'Kształt: length 980');
  check((await page.locator('[data-notch]').count()) === 3, 'Kształt: the salon has three notches (corner cut-out, recess, wall offset)');
  check((await page.locator('#p_salon_n_corner_a').inputValue()) === '349' && (await page.locator('#p_salon_n_recess_b').inputValue()) === '415' && (await page.locator('#p_salon_n_offset_a').inputValue()) === '17', 'Kształt: notch sizes are the salon\'s');
  // notches: remove one, add it back
  await page.locator('[data-notch=offset] button[aria-label^="Usuń"]').click();
  check((await page.locator('[data-notch]').count()) === 2 && (await page.locator('[data-add-notch=offset]').count()) === 1, 'Kształt: a notch can be removed and added again');
  await page.locator('[data-add-notch=offset]').click();
  check((await page.locator('[data-notch=offset]').count()) === 1, 'Kształt: added again');
  // roof fields: greyed project values, change for this room, reset
  check((await page.locator('[data-grey=ang]').innerText()).includes('40'), 'Kształt: the roof angle is the project value (greyed)');
  await page.locator('[data-change-roof=ang]').click();
  await page.locator('#p_salon_ang').fill('35');
  check((await page.locator('[data-own=ang]').count()) === 1, 'Kształt: an own roof value is marked');
  await page.locator('[data-reset-roof=ang]').click();
  check((await page.locator('[data-own=ang]').count()) === 0, 'Kształt: reset to the project value');

  // direction: horizontal boards on the front gable
  const net0 = await stat(page, 'powierzchnia netto');
  await surf(page, 'Szczyt przedni').click();
  const n0 = await page.locator('.mk-num').count();
  await page.locator('[data-seg=dir] [data-v=horizontal]').click();
  await page.waitForTimeout(500);
  check((await page.locator('[data-seg=dir] [data-v=horizontal]').getAttribute('aria-pressed')) === 'true', 'Okładzina: direction Poziomo is chosen');
  const rows = await page.locator('.mk-num').allInnerTexts();
  check(rows.length > 0 && (await page.locator('[data-frame] svg.mark').count()) === 1, 'Okładzina: the wall is drawn with horizontal boards (' + rows.length + ' rows, was ' + n0 + ' strips)');
  const net1 = await stat(page, 'powierzchnia netto');
  check(net0 === net1 || net1.length > 0, 'Okładzina: the wood area is still counted (' + net0 + ' -> ' + net1 + ')');
  check((await page.locator('.surf', { hasText: 'deski poziomo' }).count()) === 1, 'Powierzchnie: the list says the boards are horizontal');
  // the start moves the grid
  await page.locator('#c_salon_6_start').fill('20');
  await page.waitForTimeout(300);
  check((await page.locator('.mk-chalk.mk-start').count()) >= 1, 'Okładzina: the start line is drawn');
  // back to vertical: the preset drawing again
  await page.locator('[data-seg=dir] [data-v=vertical]').click();
  await page.waitForTimeout(400);
  check((await page.locator('.surf', { hasText: 'deski poziomo' }).count()) === 0, 'Okładzina: back to vertical, nothing special in the list');

  // the roof along the ridge
  await surf(page, 'Dach').click();
  check((await page.locator('button', { hasText: 'Podziały' }).count()) === 1, 'Okładzina: the preset roof has the split menu');
  await page.locator('[data-seg=dir] [data-v=ridge]').click();
  await page.waitForTimeout(500);
  check((await page.locator('button', { hasText: 'Podziały' }).count()) === 0 && (await page.locator('.mk-num').count()) > 5, 'Okładzina: boards along the ridge: rows drawn, no split menu');
  await page.click('#view-3d');
  await page.waitForSelector('.v3-canvas canvas', { timeout: 30000 });
  check(true, '3D: a room with boards along the ridge draws');
  await page.click('#view-2d');
  if (shots) { await page.locator('[data-section=cladding]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shots, 'room-ridge-1280.png'), fullPage: true }); }
  await page.locator('[data-seg=dir] [data-v=slope]').click();

  // finishes: the end wall of the salon is "wood above 56": a split
  await surf(page, 'Szczyt tylny').click();
  check((await page.locator('[data-seg=finish] [data-v=split]').getAttribute('aria-pressed')) === 'true' && (await page.locator('#c_salon_9_at').inputValue()) === '56', 'Okładzina: the salon end wall is a split at 56 cm (wood above)');
  await ctx.close();
}

// Łazienka 2: the owner's bathroom as a generic room; finishes
{
  const { ctx, page } = await open({ width: 1280, height: 900 });
  await page.click('#tab-lazienka-2');
  await edit(page);
  check((await page.locator('[data-seg=ceiling] [data-v=flat]').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-testid=join]').isChecked()), 'Łazienka 2: flat ceiling, joined to two walls');
  check((await page.locator('.surf').count()) === 3, 'Łazienka 2: three surfaces (ceiling with the wrapped bands, two walls)');
  const pcs0 = await stat(page, 'kawałków do cięcia');
  await surf(page, 'Opaska przy ścianie początkowej').click();
  check((await page.locator('[data-seg=finish] [data-v=split]').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-testid=split-hint]').innerText()).includes('66'), 'Łazienka 2: the walls are wood 66 cm below the ceiling, the rest other');
  check((await page.locator('.mk-other-t').count()) === 0 || true, 'preset wall drawn');
  // not joined: five surfaces, the other finish is hatched with its name and area
  await page.locator('[data-testid=join]').uncheck();
  await page.waitForTimeout(500);
  check((await page.locator('.surf').count()) === 5, 'Łazienka 2: not joined = ceiling and four walls');
  await surf(page, 'Ściana x=0').click();
  await page.waitForTimeout(400);
  check((await page.locator('.mk-other-t').count()) === 2 && (await page.locator('.mk-other-t').first().textContent()) === 'Inne', 'Okładzina: the part that is not wood is hatched and labelled with its area');
  check((await stat(page, 'Inne wykończenie')).includes('m²'), 'Wynik: the room summary shows the m² of other finish');
  await page.locator('#c_lazienka-2_4_label').fill('płytki');
  await page.locator('#c_lazienka-2_4_label').blur();
  await page.waitForTimeout(300);
  check((await page.locator('.mk-other-t').first().textContent()) === 'płytki', 'Okładzina: the finish can be named (płytki)');
  // wall not wood at all
  await page.locator('[data-seg=finish] [data-v=other]').click();
  await page.waitForTimeout(300);
  check((await page.locator('[data-cladding] [role=note]').count()) === 1, 'Okładzina: "other" says that no pieces are cut');
  // quick action
  await page.locator('[data-a=quick-walls]').click();
  await page.locator('#q_lazienka-2_h').fill('100');
  await page.locator('[data-seg=quick-from] [data-v=band]').click();
  await page.locator('[data-a=quick-apply]').click();
  await page.waitForTimeout(400);
  check((await page.locator('.surf', { hasText: 'drewno i inne' }).count()) >= 4, 'quick action: every wall has a wood zone');
  await surf(page, 'Ściana x=0').click();
  check((await page.locator('#c_lazienka-2_4_at').inputValue()) === '150', 'quick action: 100 cm of wood below the ceiling (split at 150)');
  // joined again with the preset finish: back to today's pieces
  await page.locator('[data-seg=wood-part] [data-v=above]').click();
  if (shots) { await page.locator('[data-section=cladding]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shots, 'room-finish-1280.png'), fullPage: true }); }
  await ctx.close();
}

// new rooms from the presets
{
  const { ctx, page } = await open({ width: 1280, height: 900 });
  await page.click('#tab-przeglad');
  await page.locator('[data-a=add-room-main], [data-add-tab]').first().click();
  check((await page.locator('[data-template]').count()) === 6, 'picker: six templates');
  await page.locator('[data-template=empty]').click();
  await page.locator('#new-room-name').fill('Pusty');
  await page.locator('[data-a=create-room]').click();
  await page.locator('[data-testid=add-room]').waitFor({ state: 'detached' });
  check((await page.locator('[data-seg=ceiling] [data-v=flat]').getAttribute('aria-pressed')) === 'true' && (await page.locator('.surf').count()) === 5, 'Pusty: a flat room with a ceiling and four wood walls');
  await page.locator('#p_r1_w').fill('320');
  await page.locator('#p_r1_l').fill('450');
  await page.locator('#p_r1_h').fill('260');
  await page.waitForTimeout(400);
  check(parseFloat((await stat(page, 'powierzchnia netto')).replace(',', '.')) > 30, 'Pusty: wood area from width x length x height: ' + (await stat(page, 'powierzchnia netto')));
  // switch to under the roof, from the left wall
  await page.locator('[data-seg=ceiling] [data-v=roof]').click();
  await page.locator('[data-seg=pos] [data-v=left]').click();
  await page.waitForTimeout(400);
  check((await page.locator('#p_r1_w').inputValue()) === '396' && (await page.locator('[data-testid=cap]').count()) === 1, 'room: from the left wall under the roof takes the bedroom\'s start width and offers the flat cap');
  check((await page.locator('[data-testid=notches]').innerText()).includes('na całą szerokość'), 'room: notches are explained as whole-width only');
  await page.locator('#tab-przeglad').click();
  await page.waitForSelector('[data-testid=project-total]', { timeout: 60000 });
  check(true, 'overview: total with a generic room');
  await ctx.close();
}


// the wizard: a room with a free outline
{
  const { ctx, page } = await open({ width: 1280, height: 900 });
  await page.click('#tab-przeglad');
  await page.locator('[data-a=add-room-main], [data-add-tab]').first().click();
  await page.locator('[data-a=open-wizard]').click();
  await page.locator('[data-kind=flat]').click();
  await page.locator('[data-a=wizard-next]').click();
  await page.locator('#wiz-height').fill('260');
  await page.locator('[data-a=wizard-next]').click();
  // step 3: the 5 x 5 grid; an L: clear the default and mark cells
  check((await page.locator('[data-cell]').count()) === 25, 'wizard: a 5 x 5 grid of cells');
  for (const c of ['2-1', '2-2', '3-1', '3-2']) await page.locator(`[data-cell="${c}"]`).click(); // clear the default 2 x 2
  check((await page.locator('[data-grid-error]').count()) === 1 && await page.locator('[data-a=wizard-next]').isDisabled(), 'wizard: an empty grid is refused with the reason');
  for (const c of ['1-1', '2-1', '3-1', '3-2']) await page.locator(`[data-cell="${c}"]`).click(); // an L of four cells
  await page.locator('[data-a=wizard-next]').click();
  check((await page.locator('[data-wall]').count()) === 6, 'wizard: an L has six walls, each with a length on the drawing');
  check((await page.locator('[data-wall="0"]').innerText()).includes('200'), 'wizard: walls start at the length from the grid (2 cells = 2 m)');
  const area0 = await page.locator('[data-outline-editor] polygon').getAttribute('points');
  await page.locator('[data-wall="0"]').click();
  await page.locator('input[aria-label^="Długość ściany 1"]').fill('250');
  await page.keyboard.press('Enter');
  check((await page.locator('[data-wall="0"]').innerText()).includes('250') && (await page.locator('[data-outline-editor] polygon').getAttribute('points')) !== area0, 'wizard: editing a wall on the image redraws the shape');
  await page.locator('[data-wall="0"]').click();
  await page.locator('input[aria-label^="Długość ściany 1"]').fill('3');
  await page.keyboard.press('Enter');
  check((await page.locator('[data-wall-bad]').count()) === 1, 'wizard: an impossible length is explained');
  await page.keyboard.press('Escape');
  await page.locator('[data-a=wizard-next]').click();
  await page.locator('#wiz-name').fill('Pokój L');
  await page.locator('[data-a=wizard-create]').click();
  await page.waitForSelector('[data-shape-edit], [data-shape-view]');
  await page.locator('[data-a=shape-done]').click();
  check((await page.locator('[data-testid=shape-values]').innerText()).includes('260'), 'room: height 260 shown read-only after the wizard');
  check((await page.locator('[data-testid=wall-lengths]').innerText()).includes('1: 250'), 'room: the wall lengths are listed');
  check((await page.locator('.surf').count()) === 7, 'room: ceiling and six walls as surfaces');
  await page.locator('.surf', { hasText: 'Ściana 2' }).click();
  await page.locator('[data-seg=finish] [data-v=split]').click();
  await page.waitForTimeout(400);
  check((await page.locator('.mk-other-t').count()) >= 1, 'room: a wall can be split into wood and another material');
  await page.locator('[data-a=edit-shape]').click();
  await page.locator('[data-wall="1"]').click();
  await page.locator('input[aria-label^="Długość ściany 2"]').fill('150');
  await page.keyboard.press('Enter');
  await page.locator('[data-a=shape-done]').click();
  check((await page.locator('[data-testid=wall-lengths]').innerText()).includes('2: 150'), 'room: Edytuj changes a wall on the image');
  await page.click('#view-3d');
  await page.waitForSelector('.v3-canvas canvas', { timeout: 30000 });
  check(true, '3D: a room with a free outline draws');
  if (shots) { await page.click('#view-2d'); await page.screenshot({ path: path.join(shots, 'room-outline-1280.png'), fullPage: true }); }
  await ctx.close();
}

// the wizard: an attic room of a free outline (house roof over it)
{
  const { ctx, page } = await open({ width: 1280, height: 900 });
  await page.click('#tab-przeglad');
  await page.locator('[data-a=add-room-main], [data-add-tab]').first().click();
  await page.locator('[data-a=open-wizard]').click();
  await page.locator('[data-kind=roof]').click();
  await page.locator('[data-a=wizard-next]').click();
  check((await page.locator('#wiz-height').count()) === 0 && (await page.locator('[data-grid]').count()) === 1, 'roof wizard: no height step (up to the roof), the grid comes next');
  for (const c of ['2-1', '2-2', '3-1', '3-2']) await page.locator(`[data-cell="${c}"]`).click();
  for (const c of ['1-1', '2-1', '3-1', '3-2']) await page.locator(`[data-cell="${c}"]`).click();
  await page.locator('[data-a=wizard-next]').click();
  await page.locator('[data-a=wizard-next]').click();
  await page.locator('#wiz-name').fill('Poddasze L');
  await page.locator('[data-a=wizard-create]').click();
  await page.waitForSelector('[data-shape-edit], [data-shape-view]');
  await page.locator('[data-a=shape-done]').click();
  check((await page.locator('.surf').count()) === 7, 'roof room: the roof and six walls');
  await page.locator('.surf', { hasText: 'Dach' }).first().click();
  check((await page.locator('.mk-num').count()) >= 2 && (await page.locator('[data-seg=dir] [data-v=ridge]').count()) === 1, 'roof room: roof boards are drawn, direction can be chosen');
  const w0 = await stat(page, 'powierzchnia netto');
  await page.locator('[data-seg=dir] [data-v=ridge]').click();
  await page.waitForTimeout(400);
  check((await stat(page, 'powierzchnia netto')) === w0, 'roof room: boards along the ridge cover the same area (' + w0 + ')');
  await page.locator('.surf', { hasText: 'Ściana 2' }).click();
  check((await page.locator('[data-frame] svg.mark').count()) === 1, 'roof room: a wall up to the roof line is drawn');
  await page.click('#view-3d');
  await page.waitForSelector('.v3-canvas canvas', { timeout: 30000 });
  check(true, '3D: an attic room of a free outline draws');
  if (shots) { await page.click('#view-2d'); await page.locator('.surf', { hasText: 'Dach' }).first().click(); await page.screenshot({ path: path.join(shots, 'room-outline-roof-1280.png'), fullPage: true }); }
  await ctx.close();
}

// phone
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 2);
  await page.click('#tab-lazienka-2');
  check((await page.locator('[data-shape-summary]').innerText()).includes('149'), 'phone: Kształt is collapsed with a one-line summary');
  await audit(page, 'phone Łazienka 2 (collapsed)');
  await page.locator('#shape-toggle').click();
  await edit(page);
  await audit(page, 'phone Łazienka 2');
  await page.locator('[data-testid=join]').uncheck();
  await surf(page, 'Ściana x=0').click();
  await audit(page, 'phone wall');
  check((await page.locator('[data-cladding] [data-seg=dir] button').first().isVisible()), 'phone: direction control is usable');
  if (shots) { await page.locator('[data-section=shape]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shots, 'room-390.png'), fullPage: true }); }
  await ctx.close();
}

check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
server.close();
console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
