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

export default defineConfig({
  // Relative base so the same build works on Cloudflare Pages, itch.io (subpath) and Capacitor (file-like origin).
  base: './',
  define: {
    // Derived from git tags; see scripts/version.mjs.
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
