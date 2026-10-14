# Architecture

Plain HTML/CSS/JavaScript, no framework, no npm dependencies at run time. `tools/build.py` joins everything into one page:
`assets/fonts/fonts.css` + `app/vendor/katex.css` + `app/css/*.css`, then `app/vendor/katex.min.js` + `app/js/*.js` in number order.
All code shares one global scope; top-level code only uses things from earlier files.

The rule that shapes everything: **the app knows nothing about any subject.** Lessons, tasks, exam structure, timing and scoring all come from the module. The app only knows how to show and check *types* of things.

## Files

| File | What it is |
|---|---|
| `00-util.js` | small helpers: escaping, seeded shuffles, number formatting per language (`4,32` in Bulgarian) |
| `01-zip.js` | `readZip`, `writeZip`: zip files without libraries (the browser's own deflate) |
| `02-module-format.js` | `checkModule` (every rule in MODULE-FORMAT.md, with readable errors), `prepareModule` (defaults, lookup tables, `ref`s resolved) |
| `03-scoring.js` | `scoreTask` for every task type, `applyScale` (points → the module's result), number and text matching rules |
| `10-i18n.js` | the app's own words in Bulgarian and English; `t()` and `tn()` (plural forms) |
| `11-store.js` | IndexedDB: installed modules, their media, progress, app-wide state |
| `12-rich.js` | markdown-lite + KaTeX math; escapes everything, so a module can never inject HTML |
| `13-library.js` | add (inspect → choose progress → install), share (export with or without progress), reset, remove, media URLs |
| `14-progress.js` | per-module progress, XP and streak |
| `20-ui.js` | navigation stack, bottom sheets, toasts, icons, sounds, confetti |
| `30-library.js` … `37-settings.js` | screens: library, module page, lesson, task views, practice, exam, settings |
| `40-native.js` | files in and out: Android bridge, or the browser when testing on a PC |
| `99-boot.js` | start |

`02` and `03` (plus `00`, `01`, `10`) have no DOM code, so `tools/check.js` runs them in Node to test the engine and every module.

## Adding a task type

1. `02-module-format.js`: add the type to `TASK_TYPES` and its rules to `checkModule`.
2. `03-scoring.js`: how a response is scored in `scoreTask`.
3. `33-tasks.js`: a builder in `TASK_BUILDERS` (`html`, `mount`, `get`, `show`) and its case in `isAnswered`.
4. `docs/MODULE-FORMAT.md` and a test in `tools/check.js`.

The type then works everywhere at once: lesson practice, exams, review and grading.

## Storage

IndexedDB database `shell`:

| Store | Key | Holds |
|---|---|---|
| `modules` | module id | `{ id, json, installedAt, usedAt, bytes }`; `json` is the module.json exactly as received |
| `media` | `"<id>\n<path>"` | Blobs for the module's pictures, audio, video |
| `progress` | module id | same shape as `progress.json` in a shared module |
| `kv` | `app`, `exam:<id>` | settings, XP, streak; an exam in progress (saved on every answer) |

## Safety of shared modules

Modules come from other people, so: all text is escaped before formatting; media can only come from inside the zip (no URLs), shown through `blob:` URLs; module JSON is checked in full before anything is stored; scoring is a description (`map`, `bands`), never code.
