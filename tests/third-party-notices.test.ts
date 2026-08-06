/**
 * The notices file is an obligation, not documentation.
 *
 * ggpbi ships as one bundle with every comment stripped, so the ISC, MIT and
 * BSD-3 notices of the code it carries survive only in THIRD-PARTY-NOTICES.md.
 * A dependency added or upgraded without regenerating it puts a distribution
 * out the door that is quietly missing a required notice — which is exactly
 * the kind of thing nobody notices until someone asks.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const NOTICES = join(ROOT, 'THIRD-PARTY-NOTICES.md');

/** Every package reachable from `dependencies`, i.e. everything shipped. */
function productionClosure(): string[] {
  const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
  const root = read(join(ROOT, 'package.json'));
  const found = new Set<string>();
  const queue: string[] = Object.keys(root.dependencies ?? {});

  while (queue.length > 0) {
    const name = queue.shift()!;
    if (found.has(name)) continue;
    found.add(name);
    const pkg = read(join(ROOT, 'node_modules', name, 'package.json'));
    queue.push(...Object.keys(pkg.dependencies ?? {}));
  }
  return [...found].sort();
}

describe('THIRD-PARTY-NOTICES.md', () => {
  const notices = readFileSync(NOTICES, 'utf8');
  const shipped = productionClosure();

  it('names every package that ships inside the bundle', () => {
    const missing = shipped.filter(name => !notices.includes(`\`${name}\``));
    expect(missing).toEqual([]);
  });

  it('reproduces the copyright line the licences require to travel', () => {
    // ISC and BSD-3 both say the notice must appear in all copies. d3 is
    // the bulk of the bundle and the one that would be missed.
    expect(notices).toContain('Mike Bostock');
    expect(notices).toMatch(/Copyright/);
  });

  it('is what the generator produces right now', () => {
    // Regenerate in place and compare: the file cannot drift behind
    // package.json without failing here.
    execFileSync('node', ['scripts/build-notices.mjs'], { cwd: ROOT, stdio: 'pipe' });
    expect(readFileSync(NOTICES, 'utf8'), 'run: npm run notices').toBe(notices);
  });

  it('accounts for every licence the dependency tree uses', () => {
    const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
    const used = new Set(
      shipped.map(name => read(join(ROOT, 'node_modules', name, 'package.json')).license),
    );
    for (const license of used) {
      expect(notices, `${license} is used but not listed`).toContain(`### ${license}`);
    }
  });

  it('stays permissive — a copyleft dependency would change ggpbi\'s terms', () => {
    // MIT cannot absorb a GPL dependency: shipping one in the bundle would
    // force the whole visual under the GPL. Better to fail the build.
    const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
    const copyleft = shipped.filter(name => {
      const license = String(read(join(ROOT, 'node_modules', name, 'package.json')).license ?? '');
      return /GPL|AGPL|LGPL|MPL|EUPL|CDDL|EPL/i.test(license);
    });
    expect(copyleft).toEqual([]);
  });

  it('ships a licence file for every dependency, so nothing is guessed at', () => {
    const withoutLicense = shipped.filter(name => {
      const files = readdirSync(join(ROOT, 'node_modules', name));
      return !files.some(f => /^(LICEN[CS]E|COPYING)(\.\w+)?$/i.test(f));
    });
    expect(withoutLicense).toEqual([]);
  });
});
