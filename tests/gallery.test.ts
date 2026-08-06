import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gallerySamples, runGallerySample } from '../docs/gallery/samples';

const docsDir = join(__dirname, '..', 'docs');
const galleryDir = join(docsDir, 'gallery');

describe('ggplot2 sample gallery', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('has unique sample ids', () => {
    const ids = gallerySamples.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const sample of gallerySamples) {
    it(`renders "${sample.id}" without NaN coordinates`, () => {
      runGallerySample(sample, container);
      const svg = container.querySelector('svg');
      expect(svg, 'sample must produce an <svg>').toBeTruthy();
      expect(svg!.querySelectorAll('*').length).toBeGreaterThan(5);

      // NaN in any geometry attribute means a mark silently vanished or
      // collapsed (browsers render NaN coordinates as 0).
      for (const el of svg!.querySelectorAll('rect, circle, line, path, text, g')) {
        for (const attr of ['x', 'y', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'd', 'transform', 'points']) {
          const v = el.getAttribute(attr);
          if (v !== null) expect(v, `<${el.tagName} ${attr}> in "${sample.id}"`).not.toMatch(/NaN/);
        }
      }
    });
  }

  it('gallery.md references every sample (and nothing else)', () => {
    const md = readFileSync(join(docsDir, 'gallery.md'), 'utf8');
    for (const sample of gallerySamples) {
      expect(md, `gallery.md must embed ${sample.id}.svg`).toContain(`gallery/${sample.id}.svg`);
      expect(md, `gallery.md must contain the code for "${sample.id}"`).toContain(sample.code);
      expect(md, `gallery.md must contain the R code for "${sample.id}"`).toContain(sample.r);
    }
    const referenced = new Set([...md.matchAll(/gallery\/([\w-]+)\.svg/g)].map((m) => m[1]));
    expect(referenced.size).toBe(gallerySamples.length);
  });

  it('every sample SVG is committed and every committed SVG has a sample', () => {
    const onDisk = readdirSync(galleryDir).filter((f) => f.endsWith('.svg')).map((f) => f.replace(/\.svg$/, '')).sort();
    const expected = gallerySamples.map((s) => s.id).sort();
    expect(onDisk).toEqual(expected);
    for (const sample of gallerySamples) {
      expect(existsSync(join(galleryDir, `${sample.id}.svg`))).toBe(true);
    }
  });
});
