# Power BI Integration

## Schnellstart: Custom Visual bauen

Dieses Repo enthält bereits die Scaffold-Dateien für ein Power BI Custom Visual:

| Datei | Zweck |
|-------|-------|
| `pbiviz.json` | Visual-Metadaten (Name, GUID, Version) |
| `capabilities.json` | Datenrollen + Format Pane Objects (GoG-Vokabular) |
| `src/pbi-visual.ts` | Die Visual-Klasse (IVisual) |
| `style/visual.less` | Styles für das Visual |
| `assets/icon.png` | 20x20 Placeholder-Icon |

### 1. PBI SDK installieren

```bash
npm install --save powerbi-visuals-api
npm install --save-dev powerbi-visuals-tools
```

### 2. Package bauen

```bash
npx pbiviz --install-cert   # einmalig
npx pbiviz package
```

### 3. In Power BI importieren

**Option A: Power BI Desktop (Windows)**

1. Power BI Desktop öffnen
2. Report mit Testdaten erstellen (Tabelle mit Kategorie + Wert)
3. Visualisierungen → Weitere Visuals → Aus Datei importieren → `dist/ggpbi.pbiviz`
4. Datenfelder zuweisen: Kategorie → Kategorie/Details, Wert → Werte

**Option B: Power BI Service im Browser (Mac/Linux)**

Power BI Desktop gibt es nur für Windows. Auf dem Mac nutzt du stattdessen den Dev-Server:

1. Dev-Server starten:
   ```bash
   npx pbiviz start
   ```
   Das startet `https://localhost:8080`.

2. Browser: [app.powerbi.com](https://app.powerbi.com) öffnen (kostenloser Account reicht)
3. Einstellungen → Entwickler → **"Developer Visual"** aktivieren
4. Einen Report öffnen oder erstellen
5. In der Visual-Palette erscheint das Developer-Visual (Werkzeug-Icon) — auf den Report ziehen
6. Datenfelder zuweisen: Kategorie → Kategorie/Details, Wert → Werte

> **Hinweis:** Der Dev-Server aktualisiert das Visual live bei Code-Änderungen.
> Für eine `.pbiviz`-Datei zum Weitergeben: `npx pbiviz package`

### Theme System (ggplot2-style)

Das Styling funktioniert wie in ggplot2: **ein Parameter (`baseSize`) bestimmt alles**.
Margins, Schriftgrößen, Tick-Länge, Abstände — alles leitet sich proportional ab.

```typescript
import { ggpbi, themeGrey, themeMinimal, themeDark } from 'ggpbi';

// Default: wie ggplot2 theme_grey(base_size = 11)
ggpbi().data(data).aes({...}).geom('bar').render(container);

// Größere Schrift für Präsentationen
ggpbi().data(data).aes({...}).geom('bar')
  .theme(themeGrey(16))
  .render(container);

// Kompakt für kleine Dashboard-Kacheln
ggpbi().data(data).aes({...}).geom('bar')
  .theme(themeGrey(7))
  .render(container);

// Eigene Einstellungen
ggpbi().data(data).aes({...}).geom('bar')
  .theme({ baseSize: 11, axisTextOverlap: 'rotate', nBreaks: 3 })
  .render(container);
```

**Abgeleitete Werte (wie in ggplot2):**

| Element | Formel | Default (baseSize=11) |
|---|---|---|
| Achsen-Text | `rel(0.8) × baseSize` | 8.8px |
| Plot-Titel | `rel(1.2) × baseSize` | 13.2px |
| Linienstärke | `baseSize / 22` | 0.5 |
| Margins | `baseSize / 2` | 5.5px |
| Tick-Länge | `rel(0.5) × halfLine` | ~2.75px |
| Punkt-Größe | `(baseSize / 11) × 1.5` | 1.5 |

**Label-Overlap (ggplot2 check.overlap):**

| Modus | Verhalten |
|---|---|
| `'hide'` (default) | Überlappende Labels ausblenden — Priorität: erster, letzter, Mitte, binär unterteilen |
| `'rotate'` | Labels um -45° drehen |
| `'none'` | Nichts tun (Labels überlappen) |

Zum Testen: `npm run demo:build && open demo/index.html` — Sektion 6 (Themes) und 7 (Overlap).

### Farbpalette

**Default: Power BI Standardfarben** (nicht D3 `schemeCategory10`).
So sehen ggpbi-Charts genauso aus wie native PBI-Visuals.

```typescript
// Default: PBI 8-color palette (#118DFF, #12239E, #E66C37, ...)
ggpbi().data(data).aes({ x: 'x', y: 'y', color: 'region' }).geom('bar').render(el);

// Eigene Palette
ggpbi().data(data).aes({ x: 'x', y: 'y', color: 'region' })
  .theme({ colorPalette: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3'] })
  .geom('bar').render(el);
```

**In Power BI Custom Visuals** wird die Host-Palette automatisch übernommen —
der User kann die Farben im Report-Theme anpassen und ggpbi reagiert darauf.
Siehe `src/pbi-visual.ts` für die Implementierung.

### Rendering Events (PDF/PPT-Export)

Power BI muss wissen, wann ein Visual fertig gerendert hat — sonst erscheint es **leer im PDF/PPT-Export**.
Das ist in `pbi-visual.ts` implementiert:

```typescript
// VOR dem Render:
this.events.renderingStarted(options);

// NACH dem Render:
this.events.renderingFinished(options);

// Bei Fehler:
this.events.renderingFailed(options, errorMessage);
```

### Format Pane (Formatierungsbereich)

Das Visual hat ein Format Pane mit GoG-Vokabular. Die Einstellungen werden in der PBIR visual.json unter `objects` gespeichert und sind im Git-Diff lesbar.

**Verfügbare Karten:**

| Karte | Einstellungen | GoG-Konzept |
|---|---|---|
| **Geometrie** | Typ: Balken, Punkte, Linie, Fläche | `geom` |
| **Stil** | Transparenz (0-1), Größe | `geomStyle` |
| **X-Achse** | Skalentyp (Auto/Linear/Log/Zeit/Kategorie), Achsentitel | `scaleX` |
| **Y-Achse** | Skalentyp (Auto/Linear/Log/Wurzel), Achsentitel | `scaleY` |
| **Legende** | Legende anzeigen/verbergen | `legend` |

**So testest du es:**

1. Visual in Power BI laden (siehe Schnellstart oben)
2. Datenfelder zuweisen (Kategorie + Wert)
3. Visual anklicken → Format-Pane öffnen (Pinsel-Icon)
4. **Geometrie → Typ** ändern: wechsle zwischen Balken/Punkte/Linie/Fläche
5. **X-Achse → Achsentitel**: "Monat" eintippen → Label erscheint unter der X-Achse
6. **Y-Achse → Achsentitel**: "Umsatz (EUR)" eintippen → Label neben der Y-Achse
7. **Stil → Transparenz**: 0.3 eingeben → Elemente werden transparent

**Series (Farbgruppierung):**

1. Ein drittes Feld (z.B. "Region") auf **Legende** ziehen
2. Die Daten werden nach diesem Feld gruppiert
3. Jede Gruppe bekommt eine eigene Farbe aus der Report-Theme-Palette
4. Eine Legende erscheint rechts neben dem Chart
5. **Legende → Legende anzeigen** ausschalten → Legende verschwindet

### Scatter-Modus (Issue #133)

Das Visual unterstützt zwei Modi, die automatisch erkannt werden:

**Kategorie-Modus** (Standard):
- Felder: `Kategorie / Details` + `Werte`
- Geeignet für: Bar, Line, Area, Boxplot

**Scatter-Modus** (automatisch wenn X-Achse belegt):
- Felder: `X-Achse` (numerisch) + `Werte` (numerisch)
- Geeignet für: Scatter, Bubble
- `Kategorie / Details` dient als Detail-Identität (ein Punkt pro Wert)
- `Größe` für Bubble-Chart (Punktgröße)

**So testest du Scatter:**

1. Zwei numerische Felder in der Datenquelle bereitstellen (z.B. Gewicht, Größe)
2. Ein Detail-Feld auf **Kategorie / Details** ziehen (z.B. Name)
3. Gewicht auf **X-Achse** ziehen
4. Größe auf **Werte** ziehen
5. Optional: Feld auf **Legende** für Farbgruppierung
6. Optional: Feld auf **Größe** für Bubble-Chart

Balken-Layer werden im Scatter-Modus automatisch zu Punkten konvertiert.

**Nicht zusammenfassen (Don't summarize):**
Alle Measure-Felder unterstützen „Nicht zusammenfassen": Rechtsklick auf das Feld im Well →
„Nicht zusammenfassen". Damit werden Rohdaten ohne Aggregation angezeigt — besonders
wichtig für Scatter Plots (jeder Punkt = individuelle Beobachtung) und Date/DateTime-Felder
(Rohwerte statt Aggregation).

### Datenrollen

| Rolle | PBI-Typ | Beschreibung |
|-------|---------|-------------|
| `category` (Kategorie / Details) | Grouping | X-Achse für Bar/Line, Detail-Identität für Scatter |
| `xAxis` (X-Achse) | GroupingOrMeasure | Numerische X-Achse für Scatter (optional) |
| `yAxis` (Werte) | GroupingOrMeasure | Numerische Y-Werte (Layer 1) |
| `yAxis2` (Werte 2) | GroupingOrMeasure | Zweite Y-Achse für Combo-Charts (Layer 2) |
| `series` (Legende) | Grouping | Farbgruppierung |
| `sizeField` (Größe) | GroupingOrMeasure | Punktgröße (Scatter/Bubble) |
| `labelField` (Beschriftung) | GroupingOrMeasure | Text-Labels |
| `tooltipFields` (QuickInfos) | GroupingOrMeasure | Tooltip-Felder |
| `facetField` (Facette) | Grouping | Kleine Multiples |

### Capabilities Flags

In `capabilities.json` sind folgende Flags gesetzt:

| Flag | Bedeutung |
|---|---|
| `supportsHighlight` | Cross-Visual-Highlighting (Klick auf Balken filtert andere Visuals) |
| `supportsMultiVisualSelection` | Selektion gilt über alle Report-Visuals |
| `supportsKeyboardFocus` | Keyboard-Navigation (Tab, Enter, Escape) |
| `supportsLandingPage` | Landing Page wenn keine Daten zugewiesen |

### Landing Page

Wenn keine Datenfelder zugewiesen sind, zeigt das Visual eine Landing Page mit Anleitung statt einer leeren Fläche.

---

## Programmatische Nutzung

In deiner Visual-Klasse (`src/pbi-visual.ts`):

```typescript
import { ggpbi, fromDataView } from 'ggpbi';

export class Visual implements IVisual {
  private container: HTMLElement;
  private host: IVisualHost;
  private events: IVisualEventService;

  constructor(options: VisualConstructorOptions) {
    this.container = options.element;
    this.host = options.host;
    this.events = options.host.eventService;
  }

  public update(options: VisualUpdateOptions) {
    this.events.renderingStarted(options);
    try {
      const dataView = options.dataViews[0];

      // Convert Power BI DataView to ggpbi format
      const data = fromDataView(dataView, {
        fieldMapping: {
          "Date": "x",
          "Sales": "y",
          "Region": "color"
        }
      });

      // Build and render the visual
      // baseSize scales with viewport — like ggplot2 base_size but adaptive
      const baseSize = Math.max(7, Math.min(11, options.viewport.width / 60));

      ggpbi()
        .data(data)
        .aes({ x: 'x', y: 'y', color: 'color' })
        .geom('point')
        .geom('line')
        .scale({ x: 'time', y: 'linear', color: 'category10' })
        .theme({ baseSize, axisTextOverlap: 'hide' })
        .size(options.viewport.width, options.viewport.height)
        .render(this.container);

      this.events.renderingFinished(options);
    } catch (e) {
      this.events.renderingFailed(options, e instanceof Error ? e.message : String(e));
    }
  }
}
```

## Field Mapping

Power BI passes data with field names like "Sum of Sales" or "Date Hierarchy". Use `fieldMapping` to map these to clean aesthetic names:

```typescript
fromDataView(dataView, {
  fieldMapping: {
    "Sum of Sales": "sales",
    "Date Hierarchy": "date",
    "Product Category": "category"
  }
});
```

## Auto-discovery

If you don't know the field names, use `getFields()`:

```typescript
import { getFields } from 'ggpbi';

const fields = getFields(dataView);
console.log(fields);
// { categories: ["Date", "Region"], values: ["Sales", "Profit"] }
```

## Multiple Values

If your DataView has multiple value columns (e.g., Sales, Profit), they'll all be added to each row:

```typescript
// Power BI DataView with:
// - Category: Date
// - Values: Sales, Profit

const data = fromDataView(dataView);
// Result:
// [
//   { Date: "2024-01-01", Sales: 100, Profit: 20 },
//   { Date: "2024-01-02", Sales: 150, Profit: 30 },
//   ...
// ]
```

Then plot them separately or together:

```typescript
ggpbi()
  .data(data)
  .aes({ x: 'Date', y: 'Sales', color: '#3b82f6' })
  .geom('line')
  .aes({ x: 'Date', y: 'Profit', color: '#10b981' })
  .geom('line')
  .render(container);
```

## Troubleshooting

### Empty data
```typescript
const data = fromDataView(dataView);
if (data.length === 0) {
  console.warn('No data in DataView');
  return;
}
```

### Missing categorical view
```typescript
if (!dataView.categorical) {
  console.error('DataView must have categorical data');
  return;
}
```
