// Bundles each Netlify Function in netlify/src into a self-contained ESM file in netlify/functions,
// so the deployed function has no imports except Node built-ins (workspace packages are inlined).
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

const config = 'export const config = { path: ["/api/projects", "/api/projects/*"] };';

mkdirSync('netlify/functions', { recursive: true });
await build({
  entryPoints: ['netlify/src/projects.ts'],
  outfile: 'netlify/functions/projects.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  footer: { js: config },
  logLevel: 'info',
});
