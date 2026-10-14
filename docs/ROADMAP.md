# Roadmap

Built step by step; each finished step is pushed here.

## Step 1: the shell (0.1.0, done)
- Module format v1 and its checker; modules are separate `.zip` files, never built into the app
- Library: add, update, share (blank or with progress), reset, remove; progress choice when a module arrives with progress
- Lessons with text, notes, math, pictures, audio and video, each paired with its own test
- Task types: choice, multi, text, number, gaps (typed, picked or word bank), order, match, open (rubric self-grading)
- Hint ladder (each hint lowers the task's worth) and word bank, both from SQL Practice
- Exam simulator: timed exam and timed parts, navigator, flags, resume after closing the app, self-grading, result on the module's scale, review
- Scoring defined by the module (`scales`: linear or step tables, bands, pass mark)
- Bulgarian/English interface, Sofia Sans with Bulgarian Cyrillic, light/dark
- Android wrapper: file picker, save/send module files, "Open with Shelly"
- Two demo modules: ДЗИ по БЕЛ, ДЗИ по математика

## Step 1½ (0.2.0, done)
- Tables and code blocks in rich text; `code` lesson block with Copy / Save; units on number answers
- Arduino Bench module (electronics course with hands-on labs)

## Step 2: study materials, flashcards, more task types
- **Study materials** per lesson and per module: PDF and long text ("what to read before this test"), with reading progress
- **Flashcards**: decks inside modules, spaced repetition, cards from mistakes
- **Tools** a module can switch on: calculator first (`tools: ["calculator"]`)
- **More task types**: highlight words in a text, sort into groups, true/false sets, error correction, image hotspots, listening with typed answers, and **code** tasks (a module can run SQL in a sandbox, from SQL Practice)

## Step 3: make your own modules
- An editor inside the app: create a module, units, lessons, tasks and exams; add pictures and recordings; export as a `.zip`

## Step 4: sharing between users
- Browse and download modules others published; publish your own

## Step 5: real content
- Full ДЗИ modules, the SAT module from BrainBurst, IELTS from BandUp, SQL from SQL Practice

## Ideas taken from SQL Practice
- Hint ladder with shrinking points (done in step 1)
- Word bank with decoys (done in step 1)
- Runnable SQL challenges checked against a result (step 2, as a `code` task type)
- Multi-touch taps for fast word-bank answering (step 2)
