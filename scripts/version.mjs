#!/usr/bin/env node
// Single source of truth for the app version, derived from git.
//   tagged commit v1.2.3          -> 1.2.3
//   3 commits after v1.2.3        -> 1.2.4-dev.3+g<sha>   (sorts after 1.2.3, before 1.2.4)
//   uncommitted changes           -> adds ".dirty" to the build metadata
//   no v* tag yet                 -> 0.0.1-dev.<n>+g<sha>
// versionCode (Android) = number of commits reachable from HEAD. main is linear
// (squash merges, no force-push), so this only ever increases there.
//
// Used by vite.config.ts (web build) and android/app/build.gradle.
// CLI: `node scripts/version.mjs` prints JSON.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Pure formatting step, unit-tested in version.test.ts.
 * @param {{ describe: string | null, commitCount: number, sha: string, dirty: boolean }} git
 *   describe: output of `git describe --tags --long --match v[0-9]*` without --dirty, or null if no tag.
 * @returns {{ version: string, versionCode: number, commit: string }}
 */
export function computeVersion({ describe, commitCount, sha, dirty }) {
  const short = sha.slice(0, 7);
  /** @type {[number, number, number]} */
  let base = [0, 0, 0];
  let distance = commitCount;
  if (describe) {
    const m = /^v(\d+)\.(\d+)\.(\d+)-(\d+)-g[0-9a-f]+$/.exec(describe);
    if (!m) throw new Error(`Unexpected git describe output: ${describe}`);
    base = [Number(m[1]), Number(m[2]), Number(m[3])];
    distance = Number(m[4]);
  }
  let version;
  if (describe && distance === 0 && !dirty) {
    version = base.join('.');
  } else {
    const next = [base[0], base[1], base[2] + 1].join('.');
    version = `${next}-dev.${distance}+g${short}${dirty ? '.dirty' : ''}`;
  }
  return { version, versionCode: Math.max(1, commitCount), commit: short };
}

/**
 * @param {string[]} args
 * @param {string} cwd
 */
function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/** Reads git state. Throws on shallow clones, which would give a wrong versionCode. */
export function readVersion(cwd = fileURLToPath(new URL('..', import.meta.url))) {
  if (git(['rev-parse', '--is-shallow-repository'], cwd) === 'true') {
    throw new Error('Shallow git clone: versionCode would be wrong. Use fetch-depth: 0.');
  }
  let describe = null;
  try {
    describe = git(['describe', '--tags', '--long', '--match', 'v[0-9]*'], cwd);
  } catch {
    // no matching tag yet
  }
  return computeVersion({
    describe,
    commitCount: Number(git(['rev-list', '--count', 'HEAD'], cwd)),
    sha: git(['rev-parse', 'HEAD'], cwd),
    dirty: git(['status', '--porcelain', '--untracked-files=no'], cwd) !== '',
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(JSON.stringify(readVersion()) + '\n');
}
