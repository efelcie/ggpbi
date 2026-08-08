/**
 * Validates that every place carrying the release version agrees.
 *
 * The version lives in four files, and only one of them is the one Power BI
 * shows: `pbiviz.json` — that number ends up in the Desktop About dialog and
 * in the `.pbiviz` filename metadata. `package.json` is what npm and the
 * GitHub tag conversation revolve around. Nothing forced the two to agree,
 * and v0.3.1 shipped a package whose visual reported `0.3.0` because of it.
 *
 * The release workflow builds from the tree, not from the tag — the tag name
 * only reaches the asset filename. So a tag pointing at a tree with stale
 * metadata produces a release that lies about itself, and no build step
 * notices. This suite is that missing step.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = (name: string) => resolve(__dirname, '..', name);
const readJson = (name: string) => JSON.parse(readFileSync(root(name), 'utf-8'));

const pkg = readJson('package.json');
const pbiviz = readJson('pbiviz.json');
const lock = readJson('package-lock.json');
const changelog = readFileSync(root('CHANGELOG.md'), 'utf-8');

describe('release version consistency', () => {
  it('package.json carries a three-segment version', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('pbiviz.json repeats that version with a fourth segment', () => {
    // Power BI wants four segments; the first three are the release.
    expect(
      pbiviz.visual.version,
      `pbiviz.json says ${pbiviz.visual.version}, package.json says ${pkg.version}. ` +
        `The visual would report the wrong version in Power BI's About dialog.`,
    ).toMatch(new RegExp(`^${pkg.version.replace(/\./g, '\\.')}\\.\\d+$`));
  });

  it('the fourth segment is 0 in a committed tree', () => {
    // Public releases always end in .0. The Try build workflow stamps its run
    // number into that segment at CI time and never commits the result — so a
    // non-zero segment here means a try build leaked into the repo.
    const build = pbiviz.visual.version.split('.')[3];
    expect(
      build,
      `pbiviz.json ends in .${build}. Committed trees end in .0; the run number ` +
        `belongs to Try build artifacts only.`,
    ).toBe('0');
  });

  it('package-lock.json agrees with package.json', () => {
    // npm writes the version twice; a hand-edited bump misses the second one.
    expect(lock.version, 'stale package-lock.json — run npm install').toBe(pkg.version);
    expect(lock.packages?.['']?.version, 'stale package-lock.json — run npm install').toBe(
      pkg.version,
    );
  });

  it('CHANGELOG.md has an entry for this version', () => {
    // A bump nobody described is a release nobody can read.
    expect(
      changelog.includes(`v${pkg.version}`),
      `no "v${pkg.version}" heading in CHANGELOG.md — describe the release before tagging it.`,
    ).toBe(true);
  });
});
