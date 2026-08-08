# Contributing to ggpbi

Contributions are welcome — features, fixes, docs, gallery samples.

## The short version

1. **Open or pick an issue** so the work has an anchor.
2. **Fork, branch, build:**
   ```bash
   git checkout -b feature/<short-name>
   npm install
   npm run build && npm test
   ```
3. **Open a PR against `main`.** Small and complete beats large and
   half-finished.

## What a PR needs to get merged

- **Tests green** — `npm test`. New behaviour comes with tests.
- **Docs in sync** — every feature is documented (`docs/guide.md`, gallery
  where it fits), and nothing lands in the docs that doesn't work. Docs and
  code are always one PR.
- **Lint clean** — `npm run lint` reports no errors.
- **English** — code, comments, commits, docs.

## Trying your change in Power BI Desktop

```bash
npm install -g powerbi-visuals-tools
pbiviz package          # → dist/ggpbi….pbiviz
```

Import the `.pbiviz` in Desktop (*Insert → More visuals → Import from file*)
and bind some fields. For a browser-only loop, `npm run demo:build` and open
`demo/index.html`.

## How this repo works

Maintainer features arrive as curated feature branches with a PR each — the
same flow you use. Your merged PR is synced into the maintainer's working
copy afterwards; if a later commit adjusts your change, the PR history keeps
the credit.

## Conventions worth knowing

- Geoms live one per file in `src/geoms/`, registered in
  `src/geoms/registry.ts`.
- The Format Pane surface is `capabilities.json` +
  `src/formatting-settings.ts`; the docs contract for report files is
  `docs/ggpbir-reference.md` with `docs/ggpbir.schema.json` (generated —
  `npm run ggpbir-schema`).
- ggplot2 is the reference for behaviour: when in doubt, do what ggplot2
  does and cite it in the PR.
