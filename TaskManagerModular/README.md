# TaskManagerModular

This is the first-pass structural refactor of the original single-file Task Manager app from `../TaskManager/index.html`.

## Current split

- `index.html`
  - Keeps the original document structure, markup, theme bootstrap, and CDN library tags.
  - Loads extracted CSS and JavaScript files in the same runtime order.
- `styles/app.css`
  - Full extraction of the original inline stylesheet.
- `src/core/storage.js`
  - Storage keys, IndexedDB helpers, localStorage fallback, and persistence utility functions.
- `src/core/runtimeHelpers.js`
  - Theme, storage-status, DOM helper, utility, and runtime support functions that sit between storage and state.
- `src/state/appState.js`
  - Mutable in-memory state and load-state persistence wiring.
- `src/core/domain.js`
  - Task, item, reporting, filtering, export, and domain logic helpers.
- `src/ui/rendering.js`
  - Stats, task list, detail panel, modal, and items rendering helpers.
- `src/app/events.js`
  - Form handlers, delegated listeners, toolbar wiring, and app initialization.

## Loading order

The app still works as a static file opened directly in the browser. The scripts are loaded in this order:

1. `src/core/storage.js`
2. `src/core/runtimeHelpers.js`
3. `src/state/appState.js`
4. `src/core/domain.js`
5. `src/ui/rendering.js`
6. `src/app/events.js`

## Intent

This pass is structural only. Logic, data shapes, storage keys, render flow, and event behavior are meant to match the original app.

## Next refactor targets

- Split `src/core/domain.js` into narrower feature files.
- Split `src/ui/rendering.js` into task-list, detail-panel, stats, and modal renderer files.
- Centralize DOM references and event binding into smaller app-layer modules.
- Optionally split `styles/app.css` after parity is confirmed.
