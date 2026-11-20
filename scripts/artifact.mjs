// Loads the code of each tab from fixtures/okladzina-domu.html (without editing it) and
// returns the objects each tab exposes through its `module.exports` path
// (taken when `document` is undefined inside mount('<slug>', function(document){...})).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE = path.join(here, '..', 'fixtures', 'okladzina-domu.html');

// Names that are not exported by the artifact itself but are plain functions in the tab's scope.
const EXTRA = {
  room: 'cutPieces:cutPieces,packCuts:packCuts,trapArea:trapArea,plateInner:plateInner,wrap:wrap,',
  shared:
    'normPiece:normPiece,splitPieces:splitPieces,pairPieces:pairPieces,search:search,layout:layout,plateSvg:plateSvg,sheets:sheets,pieceArea:pieceArea,pairLen:pairLen,',
};

export function loadArtifact() {
  const html = fs.readFileSync(FIXTURE, 'utf8');
  const re = /mount\('([a-z0-9-]+)',function\(document\)\{([\s\S]*?)\n\}\);\s*<\/script>/g;
  const out = {};
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    let body = m[2];
    const kind = slug === 'rozkroj' ? 'shared' : 'room';
    body = body.replace('module.exports={', 'module.exports={' + EXTRA[kind]);
    const module = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'document', 'window', body)(module, undefined, undefined);
    out[slug] = module.exports;
  }
  for (const s of ['salon', 'sypialnia', 'lazienka-1', 'lazienka-2', 'rozkroj']) {
    if (!out[s]) throw new Error('tab not found in fixture: ' + s);
  }
  return out;
}
