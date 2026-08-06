// Generates docs/gallery.md and docs/gallery/<id>.svg from docs/gallery/samples.ts.
//
//   npm run gallery
//
// The sample definitions are the single source of truth: the code strings in
// samples.ts are executed here to produce the SVGs and are embedded verbatim
// in the generated markdown. tests/gallery.test.ts verifies that every sample
// renders and that gallery.md stays in sync with the sample list.
//
// Rendering is pinned to UTC. d3's time scale places its ticks on local-time
// year boundaries, so the same samples generated in Vienna and in CI differed
// by one hour — a sub-pixel shift in every date axis, and a diff in four SVGs
// on every regeneration. The dates in the samples are UTC-parsed either way;
// only the tick placement was drifting.
process.env.TZ = 'UTC';

import './jsdom-globals.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gallerySamples, runGallerySample } from '../docs/gallery/samples';

const docsDir = join(process.cwd(), 'docs');
const galleryDir = join(docsDir, 'gallery');

// --- Render each sample and write its SVG ---------------------------------

for (const sample of gallerySamples) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  runGallerySample(sample, el);
  const svg = el.querySelector('svg');
  if (!svg) throw new Error(`gallery: sample "${sample.id}" produced no <svg>`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  writeFileSync(join(galleryDir, `${sample.id}.svg`), svg.outerHTML + '\n');
  el.remove();
  console.log(`  ✓ ${sample.id}.svg`);
}

// --- Generate gallery.md ---------------------------------------------------

const slug = (title) => title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

const toc = gallerySamples.map((s) => `- [${s.title}](#${slug(s.title)})`).join('\n');

const sections = gallerySamples
  .map((s) => {
    const note = s.note ? `\n> ${s.note}\n` : '';
    return `## ${s.title}

**ggplot2**

\`\`\`r
${s.r}
\`\`\`

**ggpbi**

\`\`\`js
${s.code}
\`\`\`

![${s.title}](gallery/${s.id}.svg)
${note}`;
  })
  .join('\n');

const md = `# ggplot2 Sample Gallery

<!-- GENERATED FILE — do not edit by hand.
     Edit docs/gallery/samples.ts and run: npm run gallery -->

Classic ggplot2 examples reproduced with ggpbi, side by side. Every image
below was rendered by the exact ggpbi code shown next to it — the gallery is
regenerated from [\`docs/gallery/samples.ts\`](gallery/samples.ts) with
\`npm run gallery\`, and \`tests/gallery.test.ts\` verifies that each sample
renders and that this page stays in sync.

**Try it yourself:** each snippet assumes a container element \`el\`, the
builder from the library, and a dataset from
[\`docs/gallery/data.ts\`](gallery/data.ts) (verbatim copies of the classic R
datasets \`mtcars\`, \`iris\`, \`ToothGrowth\`, \`economics\`):

\`\`\`js
import { ggpbi, themeDark, themeMinimal } from 'ggpbi';
import { mtcars, iris, toothGrowth, economics } from './gallery/data';
\`\`\`

See the [guide](guide.md) for the full API.

## Contents

${toc}
- [Not yet in ggpbi](#not-yet-in-ggpbi)

${sections}
## Not yet in ggpbi

Classic ggplot2 building blocks that have **no ggpbi equivalent yet** — the
gallery grows as these land (tracked in the
[issue backlog](https://github.com/efelcie/ggpbi/issues)):

- \`geom_errorbar()\` + \`stat_summary()\` (ggpbi has \`pointrange\`, but no crossbar/errorbar caps and no summary stat)
- \`geom_tile()\` — heatmaps
- \`geom_ribbon()\` as a standalone geom (ggpbi draws ribbons only as smooth confidence bands)
- \`geom_step()\`
- \`annotate()\` / \`geom_label()\` (text with background box)
- \`coord_polar()\` — pie/donut charts (Power BI's native pie visual covers this)
`;

writeFileSync(join(docsDir, 'gallery.md'), md);
console.log(`  ✓ gallery.md (${gallerySamples.length} samples)`);
