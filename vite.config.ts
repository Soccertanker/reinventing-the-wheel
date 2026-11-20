import { readdirSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { readVersion } from './scripts/version.mjs';

function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    return readVersion().version;
  } catch (err) {
    // In CI a wrong version must fail the build; locally (e.g. no git) fall back.
    if (process.env.CI) throw err;
    console.warn(`[version] ${(err as Error).message}; using 0.0.0-unknown`);
    return '0.0.0-unknown';
  }
}

/** Emits sw.js from sw/sw.js with this build's cache name and complete file list. */
function serviceWorker(version: string): Plugin {
  return {
    name: 'rtw-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map'));
      // Everything in public/ except host config files (e.g. Cloudflare's _headers).
      const fromPublic = (readdirSync('public', { recursive: true, withFileTypes: true }) as import('node:fs').Dirent[])
        .filter((d) => d.isFile() && !d.name.startsWith('_'))
        .map((d) => `${d.parentPath}/${d.name}`.replace(/^public\//, ''));
      const precache = ['./', ...[...built, ...fromPublic].map((f) => `./${f}`)];
      const template = readFileSync(new URL('./sw/sw.js', import.meta.url), 'utf8');
      const source = template
        .replace("'__CACHE_NAME__'", JSON.stringify(`rtw-${version}`))
        .replace('= __PRECACHE__;', `= ${JSON.stringify(precache, null, 2)};`);
      if (source.includes("'__CACHE_NAME__'") || source.includes('= __PRECACHE__;')) {
        throw new Error('sw/sw.js placeholders were not replaced');
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

const version = appVersion();

export default defineConfig({
  plugins: [serviceWorker(version)],
  // Relative base so the same build works on Cloudflare Pages, itch.io (subpath) and Capacitor (file-like origin).
  base: './',
  define: {
    // Derived from git tags; see scripts/version.mjs.
    __APP_VERSION__: JSON.stringify(version),
  },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
