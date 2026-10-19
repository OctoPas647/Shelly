# Changelog

## 0.2.1 (unreleased)
- More picture and media formats are recognised: JPEG XL (`.jxl`), APNG, BMP, ICO, JFIF; `.ogv`, `.weba`, `.3gp`
- Image blocks (lesson content and task `media`) accept an optional `"fallback"`: a second file (for example a `.webp` or `.png`) that is shown when the phone cannot decode the main picture, such as `.jxl` on an older Android WebView
- A picture that cannot be decoded and has no fallback now gets the same "missing" look as a missing file

## 0.2.0
- New module: **Arduino Bench** (English) — electrical engineering with an Arduino Uno and a breadboard: 13 units, 2 capstone builds, 40 lessons, 243 tasks, 22 Arduino sketches, 20 schematics, and a final exam on its own scale
- Lessons can show **tables** and **code blocks** in any text
- New lesson block **`code`**: a program with a **Copy** button and an optional **Save as a file** button
- Number tasks can show a **unit** next to the answer box (`"unit": "mA"`), and the correct answer now shows its tolerance (for example *10 µF (± 2.5)*)
- Numbers in answers keep their significant digits (0.155 instead of 0.16)

## 0.1.0
First version: the empty shell.
- Modules as `.zip` files: add, update, share blank or with progress, reset, remove
- Lessons with text, math, pictures, audio and video, each with its own test
- Eight task types, word bank, hint ladder
- Practice exams with timing, navigator, flags, self-grading and the module's own scoring scale
- Bulgarian and English interface; Sofia Sans with Bulgarian Cyrillic letter shapes; light and dark themes
- Android: open module files from other apps, save or send shared modules
- Demo modules: ДЗИ по БЕЛ, ДЗИ по математика
