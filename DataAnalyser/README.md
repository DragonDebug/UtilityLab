# DataAnalyser

A browser-based file-list analyser for drawing records. It parses one path per line, extracts project and supplier metadata, classifies approval types, keeps item type and category as separate fields, and exports the imported data to Excel.

**Status:** Testing

## How To Use

1. Open `index.html` in your web browser.
2. Import one or more `.txt` files into **Profile**, **Gaskets**, or **Accessories**.
3. Review the parsed rows, summary cards, and validation notes.
4. Click **Export Excel** to download the workbook grouped by item type.
5. Use **Clear imported data** to reset the current session.

## What It Parses

- Project names from supported path layouts such as `PROJECTS EXTRUDERS\...` and `Wicona project\...`.
- Supplier names from exact folder matches, aliases, fuzzy matches, and combined Wicona supplier folders such as `2026 - Elite Azrieli`.
- Approval types such as **Counter Die Drawing** and **Sample** only when a valid reference-like identifier is present.
- Record category as a separate value: `FCDD`, `Preliminary CAD die drwg`, `CDD approvals`, `SAM approvals`, or `Others`.
- Revisions including bracketed values such as `[R1]`, with missing revisions defaulting to `0`.
- Dates in supported filename formats, including cases with trailing non-structural text after the date.

## Files

- `index.html` contains the browser UI, import zones, summary layout, and results table.
- `src/main.js` handles imports, drag and drop, state updates, rendering, and export actions.
- `src/parser.js` contains the parsing and validation rules for file names and paths.
- `src/exporter.js` builds the Excel workbook grouped by item type.
- `src/constants.js` stores the project, supplier, and system reference data.

## Note

This tool runs as a local static page. No build step is required as long as the browser can load the ExcelJS CDN script used for export.