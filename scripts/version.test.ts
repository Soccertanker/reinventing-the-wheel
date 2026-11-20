import { describe, expect, it } from 'vitest';
import { computeVersion } from './version.mjs';

const sha = '9c6b2d3aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('computeVersion', () => {
  it('uses the tag on a tagged, clean commit', () => {
    expect(computeVersion({ describe: 'v1.2.3-0-g9c6b2d3', commitCount: 40, sha, dirty: false })).toEqual({
      version: '1.2.3',
      versionCode: 40,
      commit: '9c6b2d3',
    });
  });

  it('marks commits after a tag as a prerelease of the next patch', () => {
    expect(computeVersion({ describe: 'v1.2.3-3-g9c6b2d3', commitCount: 43, sha, dirty: false }).version).toBe(
      '1.2.4-dev.3+g9c6b2d3',
    );
  });

  it('marks uncommitted changes as dirty, even on a tag', () => {
    expect(computeVersion({ describe: 'v1.2.3-0-g9c6b2d3', commitCount: 40, sha, dirty: true }).version).toBe(
      '1.2.4-dev.0+g9c6b2d3.dirty',
    );
  });

  it('works before any tag exists', () => {
    expect(computeVersion({ describe: null, commitCount: 12, sha, dirty: false })).toEqual({
      version: '0.0.1-dev.12+g9c6b2d3',
      versionCode: 12,
      commit: '9c6b2d3',
    });
  });

  it('versionCode is the commit count, at least 1', () => {
    expect(computeVersion({ describe: null, commitCount: 0, sha, dirty: false }).versionCode).toBe(1);
  });

  it('rejects unexpected describe output', () => {
    expect(() => computeVersion({ describe: 'release-1', commitCount: 1, sha, dirty: false })).toThrow();
  });
});
