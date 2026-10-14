# Shelly

A Duolingo-style learning app that is **an empty shell**. Everything you study comes from **modules**: single `.zip` files with lessons, tests and full practice exams that you add, remove, reset and share inside the app. Nothing about any subject is built into the app itself.

The first two modules are small demos of the Bulgarian state matriculation exams (ДЗИ): **БЕЛ** and **математика**.

## Download

| What | File |
|---|---|
| Android app | [`downloads/Shelly-0.1.0.apk`](downloads/Shelly-0.1.0.apk) |
| Demo module: ДЗИ по БЕЛ | [`downloads/modules/matura-bel.zip`](downloads/modules/matura-bel.zip) |
| Demo module: ДЗИ по математика | [`downloads/modules/matura-math.zip`](downloads/modules/matura-math.zip) |

Install the APK, download a module `.zip` on the phone, then in Shelly tap **Добави модул** (Add a module) and pick the file. You can also open a module `.zip` straight from a file manager or a chat app with **Open with → Shelly**.

## What the app does (version 0.1)

- **Library** of modules, with streak and XP across all of them.
- **Lessons** with text, notes, formulas (LaTeX), pictures, audio and video, each paired with its own test.
- **8 task types**: one choice, several choices, typed text, typed number, fill the blanks (typed, picked, or from a word bank), put in order, match pairs, and written answers graded with a rubric.
- **Practice exams** that copy the real exam: timed parts, a navigator, flags, no answers until the end, self-grading of written tasks, and a result on the module's own scale (for example *Добър 4,22* for the matura).
- **Scoring comes from the module**: each module describes how points become its result (matura grade, IELTS band, percent…).
- **Progress lives with the module**: share a module blank, or with your progress. Whoever opens a module with progress chooses to keep it or start from zero. Any module can be reset.
- **Bulgarian and English** interface. The typeface is Sofia Sans, which uses Bulgarian Cyrillic letter shapes by default; a module in Russian automatically gets Russian shapes.
- **Fully offline.** Modules cannot load anything from the internet.

## Making modules

A module is a folder with a `module.json` (and an optional `media/` folder), zipped. The full description is in [`docs/MODULE-FORMAT.md`](docs/MODULE-FORMAT.md); the two demos in [`modules/`](modules/) are working examples.

## Building

| Target | Command | Output |
|---|---|---|
| Web page (test on a PC) | `python tools/build.py web` | `dist/web/index.html` |
| Live preview | `python tools/build.py serve` | http://localhost:8000 |
| Pack the modules | `python tools/build.py modules` | `downloads/modules/*.zip` |
| Checks | `python tools/build.py check` | engine tests, module checks, text in both languages (needs Node.js 18+) |
| Android APK | `python tools/build.py android` | `dist/android/Shelly-<version>.apk` |
| Play-through | `python tests/play.py` | plays the app in a headless browser, screenshots in `build/shots/` (needs Playwright) |

Android needs a JDK 17+ and the Android SDK with `build-tools;35.0.0` and `platforms;android-34`; no Gradle.

**Signing:** the first Android build creates a key in `platforms/android/signing/` (never committed). Every update must be signed with the same key, or the phone refuses to install it over the old app. To let GitHub build signed releases, zip `shelly.keystore` + `signing.json` into `signing.zip`, and save its base64 text as a repository secret named `SHELLY_SIGNING` (Settings → Secrets and variables → Actions).

## Folder map

```
app/
  index.template.html    page shell (the build fills it in)
  js/                    the app, numbered in load order (see docs/ARCHITECTURE.md)
  css/                   styles
  vendor/                KaTeX (math)
assets/                  fonts (Sofia Sans, KaTeX) and launcher icons
modules/                 module sources: one folder per module (NOT part of the app)
downloads/               ready files: the APK and packed modules
platforms/android/       the Android wrapper (WebView, file picker, save/send, "Open with")
tools/                   build.py, check.js, config.json
tests/                   play.py (browser play-through)
docs/                    MODULE-FORMAT.md, ARCHITECTURE.md, ROADMAP.md
```
