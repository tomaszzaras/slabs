import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLEFILE=1 pnpm build  ->  dist-single/index.html: the whole app (scripts, styles, fonts, worker) in one file
const single = !!process.env.SINGLEFILE;
// AUTH_STUB=1 pnpm build  ->  dist-stub: the test build with a stub sign-in (never deployed)
const stub = !!process.env.AUTH_STUB;

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
  base: './',
  define: { __SINGLEFILE__: JSON.stringify(single), __AUTH_STUB__: JSON.stringify(stub) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false } : stub ? { outDir: 'dist-stub' } : {},
});
