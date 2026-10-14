# Module format (version 1)

The app is an empty shell. Everything a learner reads, watches, listens to or answers comes from a **module**:
one `.zip` file that people can add, remove, reset and share. Nothing about a subject or an exam is built into the app.

```
my-module.zip
├── module.json        required: the module itself (described below)
├── progress.json      optional: someone's progress, when the module was shared "with progress"
└── media/             optional: pictures, audio, video used by the module
    ├── poem.mp3
    └── triangle.png
```

The app also accepts a zip whose files sit inside one top folder (what "Compress folder" makes on a PC).

## module.json at a glance

```json
{
  "format": 1,
  "id": "bg.matura.bel.demo",
  "version": "0.1.0",
  "lang": "bg",
  "title": "ДЗИ по БЕЛ",
  "subtitle": "Матура по български език и литература",
  "description": "Кратко описание на модула.",
  "author": "Име",
  "color": "#B4532A",
  "icon": "📖",
  "tools": [],
  "scales": { "matura": { "...": "see Scoring" } },
  "passages": { "p1": { "title": "…", "text": "…" } },
  "units": [ { "id": "u1", "title": "…", "lessons": [ { "id": "l1", "title": "…", "content": [], "practice": { "tasks": [] } } ] } ],
  "exams": [ { "id": "e1", "title": "…", "minutes": 240, "scale": "matura", "parts": [ { "title": "…", "tasks": [] } ] } ]
}
```

| Field | Required | What it is |
|---|---|---|
| `format` | yes | Always `1` for this version of the format. |
| `id` | yes | Unique id, letters/digits/`.`/`-`. Two modules with the same id are the same module (a newer one updates the older one). |
| `version` | yes | Any text, for example `0.1.0`. Shown to the learner. |
| `lang` | yes | Language of the content: `bg`, `en`, `ru`, `de`… It decides spelling rules for typed answers, number format (`4,32` in Bulgarian) and the letter shapes of Cyrillic text (Bulgarian vs Russian forms). |
| `title`, `subtitle`, `description`, `author` | `title` only | Shown in the library and on the module page. |
| `color` | no | Accent colour, `#RRGGBB`. |
| `icon` | no | One emoji, or a picture from `media/`. |
| `tools` | no | Shell tools the module needs. Tools that are not listed stay hidden. The first tool, `calculator`, arrives in step 2 (see ROADMAP.md); the field is already accepted. |
| `scales` | no | How results are turned into a score or grade (see Scoring). Without one, results are shown as a percentage. |
| `passages` | no | Shared texts (a poem, an article, a table) that several tasks refer to by id. |
| `units` | no | The learning path: units → lessons. Each lesson is paired with its own practice test. |
| `exams` | no | Full simulations of the real exam: timed parts, all tasks, a final score on the module's scale. |

A module may have lessons only, exams only, or both.

## Lessons

```json
{
  "id": "bel-l1",
  "title": "Правопис на пълен и кратък член",
  "summary": "Кога пишем -ът/-ят и кога -а/-я.",
  "content": [
    "Обикновен текст с **удебеляване**, *курсив* и __подчертаване__.",
    { "type": "note", "style": "key", "text": "Правило: …" },
    { "type": "image", "src": "media/scheme.png", "alt": "Схема", "caption": "…" },
    { "type": "audio", "src": "media/poem.mp3", "caption": "Прочит на стихотворението" },
    { "type": "video", "src": "media/lecture.mp4", "caption": "…" },
    { "type": "code", "title": "blink.ino", "file": "blink.ino", "lang": "cpp", "code": "void setup() {\n  pinMode(13, OUTPUT);\n}" }
  ],
  "practice": { "tasks": [ … ], "scale": "matura", "pass": 0.7 }
}
```

Content blocks (a plain string is a `text` block):

| `type` | Fields |
|---|---|
| `text` | `text` (rich text) |
| `note` | `text`, `style`: `key` (rule to remember), `tip`, `warn` |
| `image` | `src`, `alt`, `caption` |
| `audio` | `src`, `caption`, `transcript` (optional rich text, shown on request) |
| `video` | `src`, `caption`, `poster` (optional picture) |
| `code` | `code` (the program, shown exactly as written), `title` (optional, e.g. a file name), `lang` (optional label), `file` (optional plain file name: adds a **Save as a file** button), `caption`. Always has a **Copy** button. |

`src` always points inside the zip (`media/…`). Modules cannot load anything from the internet, so a shared module works offline and cannot track anyone.

`practice.pass` is the share of points (0–1) needed to mark the lesson as done. Default `0.6`.

## Tasks

Every task has:

| Field | |
|---|---|
| `id` | Unique within the module. Progress is stored by task id, so keep ids stable between versions. |
| `type` | One of the types below. |
| `points` | Points for a fully correct answer. Default `1`. |
| `prompt` | The question (rich text). |
| `passage` | Optional id from `passages`; the text is shown above the task. |
| `media` | Optional block (or list of blocks) like in lesson content: a picture, a recording. |
| `explain` | Optional explanation shown after answering (rich text). |
| `hint` | Optional hint, or a list of hints opened one by one. In practice every hint opened lowers what the task is worth: 75%, then 50%, then 25%. Exams show no hints. |

### Types

**`choice`**: one correct option.
```json
{ "id": "m1", "type": "choice", "points": 2, "prompt": "Колко е $2^{10}$?",
  "options": ["$512$", "$1024$", "$2048$", "$100$"], "answer": 1,
  "why": ["Това е $2^9$.", null, "Това е $2^{11}$.", "Това е $10^2$."] }
```
`why` (optional) explains each wrong option and is shown when the learner picks it.

**`multi`**: several correct options. `answer` is a list. With `"partial": true`, each correct pick earns its share and each wrong pick takes one share away (never below 0).

**`text`**: a typed word or phrase. `answer` is a string or a list of accepted answers.
By default comparison ignores capital letters, extra spaces and final punctuation. `"strict": true` compares exactly (for spelling tasks where a capital letter matters).

**`number`**: a typed number. Accepts `3,5`, `3.5`, `7/2`, `-1,25`. Optional `tolerance` (default exact): any answer within ± `tolerance` of `answer` is right.
Optional `unit` (short text such as `"mA"` or `"Ω"`) is shown after the answer box and in the correct answer.

**`gaps`**: fill the blanks inside a text. Write `[[1]]`, `[[2]]`… in `text`, and give one entry per blank in `gaps`.
A blank is typed (`"answer": "…"` or a list) or picked from a list (`"options": […], "answer": index`). Each blank is worth `points / number of blanks`.
```json
{ "id": "b3", "type": "gaps", "points": 2, "prompt": "Попълнете липсващите букви.",
  "text": "Учени[[1]] обясни задачата на ученици[[2]].",
  "gaps": [ { "options": ["ът", "а"], "answer": 0 }, { "options": ["те", "т"], "answer": 0 } ] }
```

**Word bank** (`gaps` only): add `"bank": ["wrong word", …]` and the typed blanks are filled by tapping words instead of typing. The right answers and the extra words are mixed together. Good for spelling and word-order tasks, and on a phone it is quicker than typing.
```json
{ "id": "a4", "type": "gaps", "strict": true, "text": "[[1]] влезе и всички поздравиха [[2]].",
  "gaps": [ { "answer": "Директорът" }, { "answer": "директора" } ], "bank": ["Директора", "директорът"] }
```

**`order`**: put items in the right order. `items` is the correct order; the app shuffles them. With `"partial": true`, each item in the right place earns its share.

**`match`**: connect pairs. `left[i]` belongs with `right[i]`; `extra` adds wrong right-hand choices. Each correct pair earns its share.

**`open`**: a written answer (a short commentary, an essay, a full math solution). It cannot be checked automatically, so the learner grades it against the rubric after writing, the way an examiner would.
```json
{ "id": "b41", "type": "open", "points": 30, "prompt": "Напишете есе…", "minWords": 300,
  "answer": "Примерен отговор или план (по желание).",
  "rubric": [ { "text": "Съответствие с темата", "points": 6 }, { "text": "Аргументация", "points": 12 }, … ] }
```
The rubric points must add up to `points`. Each criterion can be given 0 up to its points.

## Exams

```json
{ "id": "dzi-1", "title": "Пробна матура 1", "minutes": 240, "scale": "matura",
  "description": "Като истинския изпит: …",
  "parts": [
    { "title": "Част 1", "instructions": "…", "tasks": [ { "ref": "b1" }, { "id": "b2", "type": "choice", … } ] },
    { "title": "Част 2", "minutes": 60, "tasks": [ … ] }
  ] }
```
- Timing: `minutes` on the exam is the total time; a part with its own `minutes` gets its own timer and locks when it ends.
- Tasks in an exam are written in place, or reuse a lesson task with `{ "ref": "task-id" }`.
- No answers are shown until the end. Then the learner grades the `open` tasks with their rubrics, gets the final result on the exam's `scale`, and can review every task.

## Scoring

Each exam is scored the way its real counterpart is. A module describes that in `scales`; the app only follows the description. A scale turns the points earned into the final result in three steps:

1. **Rescale** (optional): `outOf` scales the points to that total first. A short demo test worth 20 points can still be graded "as if out of 100".
2. **Map**: `map` is a list of `[points, result]` pairs, smallest points first.
   - `"mode": "linear"` (default) draws straight lines between the pairs. Use two pairs at the same `points` value to make a jump (like Слаб 2 → Среден 3).
   - `"mode": "steps"` uses the result of the last pair whose points are not above the score. This suits band tables (IELTS raw score → band).
3. **Present**: `round` sets the decimals, `bands` gives names to ranges, `show` lays out the text.

```json
"scales": {
  "matura": {
    "title": "Оценка",
    "outOf": 100,
    "map": [[0, 2], [30, 2], [30, 3], [100, 6]],
    "round": 2,
    "bands": [[2, "Слаб"], [3, "Среден"], [3.5, "Добър"], [4.5, "Много добър"], [5.5, "Отличен"]],
    "pass": 3,
    "show": "{band} {value}"
  }
}
```
`{band}`, `{value}`, `{points}` and `{max}` can be used in `show`. `pass` is the lowest passing result.

## Rich text

Used in prompts, options, explanations, passages and lesson text.

| Write | Get |
|---|---|
| `**bold**`, `*italic*`, `__underlined__`, `~~struck out~~` | formatting |
| a blank line | new paragraph |
| `- item` / `1. item` | lists |
| `### Heading` | heading |
| `> text` | quote |
| `$x^2 + 1$` | math inside a line |
| `$$\frac{a}{b}$$` | math on its own line |
| `` `code` `` | code inside a line |
| a line with ```` ``` ```` (optionally ```` ```cpp ````), the code, then a line with ```` ``` ```` | a code block, shown exactly as written |
| `\| a \| b \|` rows with a `\|---\|---\|` line under the first | a table; `:---:` centres a column, `\\|` is a literal \| inside a cell |
| `\$` | a real dollar sign |

Math uses LaTeX (KaTeX). Text inside math can be Cyrillic: `$\text{лице} = a \cdot b$`.

## progress.json

Written by the app when a module is shared "with progress". Someone who opens such a module chooses to **keep that progress** or **start from zero**.

```json
{ "format": 1, "module": "bg.matura.bel.demo", "moduleVersion": "0.1.0", "updated": "2026-10-14T10:00:00Z",
  "xp": 120,
  "lessons": { "bel-l1": { "best": 0.8, "runs": 2, "done": true } },
  "tasks": { "b3": { "n": 3, "ok": 2, "last": 1760436000000 } },
  "exams": [ { "exam": "dzi-1", "at": "2026-10-14T10:00:00Z", "points": 63.5, "max": 100, "value": 4.58, "secs": 9000 } ] }
```
