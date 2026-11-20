import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  // Relative base so the same build works on Cloudflare Pages, itch.io (subpath) and Capacitor (file-like origin).
  base: './',
  define: {
    // Pipeline step 4 will replace this with a git-tag-derived version.
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? pkg.version),
  },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
