# ExcelListsGenerator

A browser-based workbook generator that creates an Excel file filled with reusable dropdown list tables for statuses, priorities, departments, and other tracking values.

**Status:** Testing

## How To Use

1. Open `index.html` in your web browser.
2. Click **Generate Workbook** to download the Excel template.
3. Edit `constants.js` if you want to add, remove, or rename the available list values before generating a new workbook.

## Files

- `index.html` contains the page UI and loads the generator scripts.
- `constants.js` stores the editable list values and table definitions.
- `main.js` contains the workbook generation logic and download behavior.

## Note

This tool runs as a local static page. No install step is required as long as the page can load the SheetJS CDN script.