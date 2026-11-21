// Builds the Vercel deployment as Build Output API v3 in .vercel/output:
//   static/                         the web app (packages/web/dist)
//   functions/api/projects.func/    /api/projects[/:id], bundled by esbuild into ONE self-contained ESM file
//                                   (workspace packages inlined, no node_modules needed at runtime)
//   config.json                     routes: static files first, then /api/projects[/*] -> the function
// Usage: node scripts/build-vercel.mjs [--skip-web]   (--skip-web reuses an existing packages/web/dist)
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const out = '.vercel/output';
const fn = `${out}/functions/api/projects.func`;

if (!process.argv.includes('--skip-web')) execSync('pnpm build', { stdio: 'inherit' });
if (!existsSync('packages/web/dist/index.html')) throw new Error('packages/web/dist/index.html missing: run the web build first');

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });
cpSync('packages/web/dist', `${out}/static`, { recursive: true });

await build({
  entryPoints: ['vercel/projects.ts'],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'info',
});
writeFileSync(`${fn}/package.json`, JSON.stringify({ type: 'module' }) + '\n');
writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs' }, null, 2) + '\n');
writeFileSync(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '^/api/projects(?:/.*)?$', dest: '/api/projects' },
  ],
}, null, 2) + '\n');
console.log('Vercel output written to', out);
