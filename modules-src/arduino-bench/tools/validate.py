"""Re-computes every numeric answer in src/ from its formula.

    python3 modules-src/arduino-bench/tools/validate.py

Every numeric / measure / resistor task carries a `calc` expression. It is evaluated and
compared with the stated answer, so a typo in an answer can't ship. Colour-band tasks are
checked against their bands too.
"""
import math
import os
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors = []

def resistor_value(bands):
    digits = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "grey", "white"]
    *sig, mult, _tol = bands
    v = 0
    for b in sig:
        v = v * 10 + digits.index(b)
    return v * 10 ** digits.index(mult)


def check_math():
    ns = {"log": math.log, "exp": math.exp, "sqrt": math.sqrt, "pi": math.pi,
          "abs": abs, "round": round, "math": math}
    src = os.path.join(ROOT, "src")
    files = [os.path.join(src, "units", f) for f in sorted(os.listdir(os.path.join(src, "units")))]
    files += [os.path.join(src, "capstones.yaml"), os.path.join(src, "final_exam.yaml")]
    checked = 0

    def walk(node, where):
        nonlocal checked
        if isinstance(node, dict):
            if node.get("type") in ("numeric", "measure", "resistor"):
                stated = node.get("answer", node.get("expected"))
                if "calc" not in node:
                    errors.append(f"{where}: numeric task without calc: {node['q'][:60]}")
                else:
                    got = eval(node["calc"], {"__builtins__": {}}, ns)
                    tol = node.get("tol", 0)
                    if isinstance(tol, str):
                        allowed = abs(got) * float(tol[:-1]) / 100 / 2
                    else:
                        allowed = float(tol) / 2
                    allowed = max(allowed, abs(got) * 0.005, 1e-9)
                    if abs(stated - got) > allowed:
                        errors.append(f"{where}: stated {stated} but calc gives {got:.6g} — {node['q'][:70]}")
                    checked += 1
                if node.get("type") == "resistor" and resistor_value(node["bands"]) != node["answer"]:
                    errors.append(f"{where}: colour bands {node['bands']} ≠ {node['answer']}")
            for v in node.values():
                walk(v, where)
        elif isinstance(node, list):
            for v in node:
                walk(v, where)

    for f in files:
        walk(yaml.safe_load(open(f, encoding="utf-8")), os.path.relpath(f, ROOT))
    return checked


def main():
    checked = check_math()
    for e in errors:
        print("ERROR:", e)
    print(f"{checked} numeric answers re-computed from their formulas, {len(errors)} errors")
    print("Structure is checked by Shelly itself: python tools/build.py check (from the repo root)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
