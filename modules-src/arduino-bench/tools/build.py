"""Builds the Arduino Bench module for Shelly from the YAML sources.

    python3 modules-src/arduino-bench/tools/build.py      (from the repo root, or from anywhere)

Writes  modules/arduino-bench/module.json  +  modules/arduino-bench/media/…
Then `python tools/build.py check` checks it and `python tools/build.py modules` packs it into
downloads/modules/arduino-bench.zip, like every other module.

How the course maps onto Shelly's format (docs/MODULE-FORMAT.md):
    course unit                      -> Shelly unit
      theory + formulas + key facts  -> lesson "Theory", its practice test = the unit quiz
      each lab                       -> lesson "Lab: …" (parts, schematic, wiring table, sketch as a
                                        code block, numbered steps), its practice test = the lab's
                                        predictions, measurements and observation questions
    capstone                         -> unit, same lessons
    final exam                       -> exam with 3 timed-together parts, scored on the "bench" scale
Task types:  mcq/truefalse/codeline -> choice · multi -> multi · numeric/measure/resistor -> number
             (relative tolerance turned into ± absolute, unit shown next to the box) · order · match ·
             fill -> text · record -> a "write it down" step in the lesson text (not graded)
Task ids are stable: u03.quiz.7, u03.lab2.s4, exam.12 … (progress is stored by task id).
"""
import json
import os
import re
import shutil
import sys

import yaml

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))     # modules-src/arduino-bench
REPO = os.path.dirname(os.path.dirname(HERE))                          # the Shelly repo
OUT = os.path.join(REPO, "modules", "arduino-bench")
SRC = os.path.join(HERE, "src")


def load(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def cell(text):
    """Text that goes inside a table cell: no line breaks, literal pipes escaped."""
    return str(text).replace("\n", " ").replace("|", "\\|")


def table(head, rows):
    out = ["| " + " | ".join(cell(h) for h in head) + " |", "|" + "---|" * len(head)]
    out += ["| " + " | ".join(cell(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def tolerance(tol, answer):
    """'5%' -> ± 5 % of the answer; a number -> ± that number; 0/None -> exact."""
    if tol in (None, 0, "0", "0%"):
        return None
    if isinstance(tol, str) and tol.strip().endswith("%"):
        return round(abs(answer) * float(tol.strip()[:-1]) / 100, 12)
    return float(tol)


TRIVIAL_LINE = re.compile(r"^\s*([{}()\[\];]*|//.*)\s*$")


def convert_task(raw, task_id, points_default):
    """One source task -> one Shelly task (or None for ungraded 'record' steps)."""
    t = dict(raw)
    kind = t["type"]
    if kind == "record":
        return None
    out = {"id": task_id, "type": None, "points": t.get("points", points_default.get(kind, 1)), "prompt": t["q"]}
    if kind == "mcq":
        out.update(type="choice", options=t["options"], answer=t["answer"])
    elif kind == "truefalse":
        out.update(type="choice", options=["True", "False"], answer=0 if t["answer"] else 1)
    elif kind == "multi":
        out.update(type="multi", options=t["options"], answer=t["answers"], partial=True)
    elif kind in ("numeric", "measure", "resistor"):
        ans = t["expected"] if kind == "measure" else t["answer"]
        out.update(type="number", answer=ans)
        tol = tolerance(t.get("tol"), ans)
        if tol:
            out["tolerance"] = tol
        unit = t.get("unit") or ("Ω" if kind == "resistor" else "")
        if unit and len(unit) <= 12:
            out["unit"] = unit
        if kind == "measure":
            out["prompt"] = "**Measure:** " + t["q"] + "\n\nType the value you actually read."
        if kind == "resistor":
            for b in t["bands"]:
                assert b in t["q"], f"{task_id}: band '{b}' missing from the prompt"
            out["prompt"] = t["q"] + "\n\nAnswer in ohms, e.g. 4700 for 4.7 kΩ."
    elif kind == "order":
        out.update(type="order", items=t["items"], partial=True)
    elif kind == "match":
        out.update(type="match", left=[a for a, _ in t["pairs"]], right=[b for _, b in t["pairs"]])
    elif kind == "fill":
        out.update(type="text", answer=t["accept"])
    elif kind == "codeline":
        lines = t["code"].rstrip("\n").split("\n")
        width = len(str(len(lines)))
        numbered = "\n".join(f"{str(i).rjust(width)} │ {l}" for i, l in enumerate(lines, start=1))
        keep = [i for i, l in enumerate(lines, start=1) if not TRIVIAL_LINE.match(l) or i == t["answer"]]
        out.update(type="choice",
                   prompt=t["q"] + "\n\n```cpp\n" + numbered + "\n```",
                   options=[f"Line {i}: `{lines[i - 1].strip()}`" for i in keep],
                   answer=keep.index(t["answer"]))
    else:
        raise ValueError(f"{task_id}: unknown task type {kind}")
    for key in ("explain", "hint"):
        if t.get(key):
            out[key] = t[key]
    return out


def theory_lesson(u, points_default):
    uid, study = u["id"], u.get("study") or {}
    content = []
    if u.get("objectives"):
        content.append({"type": "note", "style": "key",
                        "text": "**In this unit you will**\n\n" + "\n".join(f"- {o}" for o in u["objectives"])})
    content.append(study.get("body", "").strip())
    for m in study.get("media", []):
        content.append({"type": "image", "src": f"media/diagrams/{m['image']}.svg", "alt": m.get("caption", ""),
                        "caption": m.get("caption", "")})
    if study.get("formulas"):
        content.append({"type": "note", "style": "key",
                        "text": "**Formula sheet**\n\n" + table(["", "Formula"], [[f["name"], f["formula"]] for f in study["formulas"]])})
    if u.get("flashcards"):
        content.append({"type": "note", "style": "tip",
                        "text": "**Remember**\n\n" + "\n".join(f"- **{a}** — {b}" for a, b in u["flashcards"])})
    tasks = [convert_task(t, f"{uid}.quiz.{i}", points_default) for i, t in enumerate(u.get("quiz", []), start=1)]
    lesson = {"id": f"{uid}-theory", "title": "Theory" if u.get("kind") != "capstone" else "The plan",
              "summary": u.get("tagline", ""), "content": [c for c in content if c]}
    tasks = [t for t in tasks if t]
    if tasks:
        lesson["practice"] = {"tasks": tasks, "pass": 0.7}
    return lesson


def lab_lesson(u, lab, sketches_dir, points_default):
    uid, lid = u["id"], f"{u['id']}.{lab['id']}"
    head = f"**Goal:** {lab.get('goal', '')}"
    if lab.get("minutes"):
        head += f"\n\nAbout {lab['minutes']} minutes" + (" · optional bonus lab" if lab.get("optional") else "") + "."
    content = [head]
    if lab.get("parts"):
        content.append({"type": "note", "style": "key", "text": "**You need**\n\n" + "\n".join(f"- {p}" for p in lab["parts"])})
    if lab.get("schematic"):
        content.append({"type": "image", "src": f"media/diagrams/{lab['schematic']}.svg", "alt": "Schematic", "caption": "Schematic"})
    if lab.get("wiring"):
        content.append("### Wiring\n\n" + table(["From", "To"], lab["wiring"]))
    if lab.get("sketch"):
        name = lab["sketch"]
        with open(os.path.join(sketches_dir, name, name + ".ino"), encoding="utf-8") as f:
            code = f.read()
        content.append({"type": "code", "title": f"{name}.ino", "file": f"{name}.ino", "lang": "Arduino",
                        "code": code.rstrip("\n"),
                        "caption": "Copy it into Arduino IDE 2 (board: Arduino Uno). Serial Monitor at 115200 baud."
                        if "Serial.begin(115200)" in code else "Copy it into Arduino IDE 2 (board: Arduino Uno)."})

    steps, tasks, q = [], [], 0
    for i, s in enumerate(lab.get("steps", []), start=1):
        sid = f"{lid}.s{i}"
        if isinstance(s, str):
            steps.append(s)
            continue
        if "note" in s:
            steps.append(s["note"])
            continue
        task = convert_task(s, sid, points_default)
        if task is None:  # record: a 'write it down' step
            unit = f" ({s['unit']})" if s.get("unit") else ""
            steps.append(f"**Write down:** {s['q']}{unit}")
            continue
        q += 1
        label = {"numeric": "Predict", "measure": "Measure", "resistor": "Read"}.get(s["type"], "Check")
        steps.append(f"**{label}** → lab test, question {q}: {s['q']}")
        tasks.append(task)
    if steps:
        content.append("### Step by step\n\n" + "\n".join(f"{n}. {cell_line(x)}" for n, x in enumerate(steps, start=1)))
        content.append({"type": "note", "style": "tip",
                        "text": "Do the steps on your breadboard first. Then open the **lab test** below and type in your predictions and the real readings from your multimeter or Serial Monitor."})
    if lab.get("observe"):
        content.append({"type": "note", "style": "key", "text": "**What you should see**\n\n" + lab["observe"].strip()})
    if lab.get("troubleshooting"):
        content.append("### If it doesn't work\n\n" + "\n".join(f"- **{p}** — {f}" for p, f in lab["troubleshooting"]))
    if lab.get("challenges"):
        content.append({"type": "note", "style": "tip", "text": "**Challenges**\n\n" + "\n".join(f"- {c}" for c in lab["challenges"])})

    lesson = {"id": f"{uid}-{lab['id']}", "title": "Lab: " + lab["title"], "summary": lab.get("goal", ""), "content": content}
    if tasks:
        lesson["practice"] = {"tasks": tasks, "pass": 0.6}
    return lesson


def cell_line(text):
    """A step must stay on one line to remain one item of the numbered list."""
    return " ".join(str(text).split())


def before_you_start(meta):
    hw = meta["hardware"]
    rows = [[p["item"], p.get("qty", "")] for p in hw["required"]]
    opt = [[p["item"], p.get("qty", "")] for p in hw["optional"]]
    return {
        "id": "start",
        "title": "Before you start: parts & safety",
        "summary": "What to have on your desk, and the rules that keep you and your Arduino alive.",
        "content": [
            meta["description"].strip(),
            "### How every unit works\n\n1. **Theory** — read it, then take the theory test.\n2. **Labs** — predict a value, build the circuit, measure it with your multimeter, then type your predictions and real readings into the lab test.\n3. Your readings are graded against the expected value with a tolerance, because real parts are never exact.",
            {"type": "note", "style": "key", "text": f"**Board:** {hw['board']}\n\n**Tools**\n\n" + "\n".join(f"- {t}" for t in hw["tools"])},
            "### Parts (a typical \"most complete\" starter kit)\n\n" + table(["Part", "How many"], rows),
            "### Optional extras (cheap)\n\n" + table(["Part", "How many"], opt),
            {"type": "note", "style": "warn", "text": "**Safety**\n\n" + "\n".join(f"- {s}" for s in meta["safety"])},
        ],
    }


def main():
    meta = load(os.path.join(SRC, "module.yaml"))
    points_default = meta["scoring"]["taskPoints"]
    sketches = os.path.join(HERE, "sketches")

    unit_files = sorted(f for f in os.listdir(os.path.join(SRC, "units")) if re.match(r"u\d+\.yaml$", f))
    course = [load(os.path.join(SRC, "units", f)) for f in unit_files]
    caps = load(os.path.join(SRC, "capstones.yaml"))
    for c in caps:
        c["kind"] = "capstone"

    units = []
    for u in course + caps:
        lessons = [theory_lesson(u, points_default)] + [lab_lesson(u, l, sketches, points_default) for l in u.get("labs", [])]
        title = u["title"] if u.get("kind") != "capstone" else f"Capstone {u['number']}: {u['title']}"
        units.append({"id": u["id"], "title": title, "description": u.get("tagline", ""), "lessons": lessons})
    units[0]["lessons"].insert(0, before_you_start(meta))

    exam_src = load(os.path.join(SRC, "final_exam.yaml"))
    names = {u["id"]: (f"Unit {u['number']} — {u['title']}" if u.get("kind") != "capstone" else f"Capstone {u['number']} — {u['title']}") for u in course + caps}
    parts = {2: [], 3: [], 4: []}
    for i, raw in enumerate(exam_src["tasks"], start=1):
        task = convert_task(raw, f"exam.{i}", points_default)
        if raw.get("covers"):
            task["explain"] = (task.get("explain", "") + f"\n\n*Revise: {names[raw['covers']]}*").strip()
        parts[task["points"]].append(task)
    exam = {
        "id": "bench-license",
        "title": "Final exam: Bench License",
        "minutes": meta["scoring"]["finalExam"]["minutes"],
        "scale": "bench",
        "description": "All units, 100 points, 75 minutes, no hints. **70 points = Bench License**, 90 = with distinction. Every answer tells you which unit to revise.",
        "parts": [
            {"title": "Part 1 · Concepts", "instructions": "20 questions × 2 points.", "tasks": parts[2]},
            {"title": "Part 2 · Calculations", "instructions": "12 questions × 3 points. Calculator allowed.", "tasks": parts[3]},
            {"title": "Part 3 · Multi-step problems", "instructions": "6 questions × 4 points.", "tasks": parts[4]},
        ],
    }

    module = {
        "format": 1,
        "id": "en.electronics.arduino-bench",
        "version": meta["version"],
        "lang": "en",
        "title": meta["title"],
        "subtitle": meta["subtitle"],
        "description": "Electrical engineering through hands-on Arduino + breadboard labs: 13 units, 2 capstone builds (a 4-mode bench meter and a homemade oscilloscope) and a final exam. Every lab: predict, build, measure with your multimeter, compare. For people who can already blink an LED.",
        "author": meta["author"],
        "color": meta["accent"],
        "icon": "media/icon.svg",
        "scales": {
            "bench": {
                "title": "Result", "outOf": 100, "map": [[0, 0], [100, 100]], "round": 0,
                "bands": [[0, "Not yet"], [70, "Bench License"], [90, "Bench License with distinction"]],
                "pass": 70, "show": "{band} · {value}/100",
            }
        },
        "units": units,
        "exams": [exam],
    }

    # write module + media
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "media", "diagrams"))
    shutil.copy2(os.path.join(HERE, "assets", "icon.svg"), os.path.join(OUT, "media", "icon.svg"))
    used = set(re.findall(r'media/diagrams/([\w-]+)\.svg', json.dumps(module)))
    for name in sorted(used):
        shutil.copy2(os.path.join(HERE, "assets", "diagrams", name + ".svg"), os.path.join(OUT, "media", "diagrams", name + ".svg"))
    with open(os.path.join(OUT, "module.json"), "w", encoding="utf-8") as f:
        json.dump(module, f, ensure_ascii=False, indent=1)
        f.write("\n")

    n_lessons = sum(len(u["lessons"]) for u in units)
    n_tasks = sum(len(l.get("practice", {}).get("tasks", [])) for u in units for l in u["lessons"]) + sum(len(p["tasks"]) for p in exam["parts"])
    print(f"wrote {os.path.relpath(OUT, REPO)}/module.json: {len(units)} units, {n_lessons} lessons, {n_tasks} tasks, "
          f"{len(used)} diagrams, exam = {sum(t['points'] for p in exam['parts'] for t in p['tasks'])} pts")


if __name__ == "__main__":
    sys.exit(main())
