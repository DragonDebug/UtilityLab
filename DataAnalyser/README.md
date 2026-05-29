# DataAnalyser

A browser-based file-list analyser for drawing records. It parses one path per line, extracts project and supplier metadata, classifies approval types, keeps item type and category as separate fields, and exports the imported data to Excel.

**Status:** Testing

## How To Use

1. Open `index.html` in your web browser.
2. Import one or more `.txt` files into **Profile**, **Gaskets**, or **Accessories**.
3. Review the summary cards and approval dashboard.
4. Use the dashboard tabs to compare **All**, **Profile**, **Gaskets**, and **Accessories** approvals by yearly, monthly, or weekly volume.
5. Use **Show recent periods only** to keep the chart focused on the latest years, months, or weeks when you do not need the full history.
6. Filter the chart to all approvals, **CDD** only, **SAM** only, specific approval statuses, or totals with revision records included/excluded.
7. Click **Export Excel** to download the workbook grouped by item type.
8. Click **Export Approval Report** to download a separate current-year PDF approval report with YTD category totals and a monthly breakdown.
9. Use **Clear imported data** to reset the current session.

## What It Parses

- Project names from supported path layouts such as `PROJECTS EXTRUDERS\...` and `Wicona project\...`.
- Supplier names from exact folder matches, aliases, fuzzy matches, and combined Wicona supplier folders such as `2026 - Elite Azrieli`.
- Approval types such as **Counter Die Drawing** and **Sample** only when a valid reference-like identifier is present.
- Record category as a separate value: `FCDD`, `Preliminary CAD die drwg`, `CDD approvals`, `SAM approvals`, or `Others`.
- Revisions including bracketed values such as `[R1]`, with missing revisions defaulting to `0`.
- Dates in supported filename formats, including cases with trailing non-structural text after the date.

## Files

- `index.html` contains the browser UI, import zones, summary layout, Chart.js approval dashboard, and dashboard controls.
- `src/main.js` handles imports, drag and drop, state updates, dashboard rendering, and export actions.
- `src/approvalAnalytics.js` aggregates CDD and SAM approval records for the dashboard.
- `src/approvalDashboard.js` binds dashboard controls and renders the Chart.js approval chart.
- `src/parser.js` contains the parsing and validation rules for file names and paths.
- `src/exporter.js` builds both the grouped-record workbook and the separate current-year approval report workbook.
- `src/constants.js` stores the project, supplier, and system reference data.

## Dashboard Counting

The approval dashboard includes only **CDD approvals** (`Counter Die Drawing`) and **SAM approvals** (`Sample`) from **PDF files**. Matching approvals from `.dwg` files are excluded from the dashboard counts. By default, it counts all matching PDF CDD/SAM records regardless of approval status, including approved, approved with comments, rejected, and unclassified statuses. Use the approval status control to narrow the chart when needed.

The chart opens in a reduced recent-history view by default. Turn off **Show recent periods only** whenever you want to inspect the full timeline.

Revision records are included by default so dashboard totals match imported approval records. Turn off **Include revision records** to exclude non-zero revisions such as `R1` from the chart and KPI cards.

## Approval Report Export

The separate approval report export uses the current calendar year only. It includes PDF CDD and SAM approvals with valid dates, summarizes totals across `All Categories`, `Profile`, `Gaskets`, and `Accessories`, and adds a month-by-month worksheet for the same year.

## Note

This tool runs as a local static page. No build step is required as long as the browser can load the ExcelJS CDN script used for export and the Chart.js CDN script used for the approval dashboard.