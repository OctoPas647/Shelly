# Arduino Bench — source

The editable source of the **Arduino Bench** module (electrical engineering with an Arduino Uno and a breadboard).
The finished module that Shelly loads is built into [`modules/arduino-bench/`](../../modules/arduino-bench/) and packed into `downloads/modules/arduino-bench.zip`.

| | |
|---|---|
| Units | 13 + 2 capstone builds |
| Lessons | 40 (a Theory lesson per unit + one lesson per lab) |
| Tasks | 243, plus a 38-question final exam (100 points) |
| Arduino sketches | 22, all compile for the Uno, shown in the app as code blocks with a Copy button |
| Schematics | 20 SVGs |
| Time | ~27 hours of hands-on work |

## What's in it

| # | Unit | Labs |
|---|---|---|
| 0 | Bench Check | Know your bench (breadboard, meter, colour codes, real 5 V) |
| 1 | Divider Detective | Stiff vs weak dividers, meter loading, the Arduino measures its own Vcc |
| 2 | Trace the Curve | LED / diode I-V curve tracer, diode as a thermometer |
| 3 | Capacitors & Time | Capacitance meter, PWM + RC = homemade DAC |
| 4 | Small Current, Big Current | Transistor LED bank, motor + flyback diode |
| 5 | Clean Inputs | Contact bounce seen by interrupts, reaction tester |
| 6 | Three Pins, Eight Outputs | 74HC595 counter, 7-segment electronic die |
| 7 | Sensing the World | Calibrated thermistor thermometer, night light with hysteresis |
| 8 | Echoes & Tones | Sonar rangefinder + pentatonic theremin |
| 9 | The 555 and the Frequency Counter | Timing capacitor at ⅓/⅔ Vcc, gate vs period counting |
| 10 | Motion & Feedback | L293D brake vs coast, sun-tracking servo, stepper (bonus) |
| 11 | Talking Chips | Optical serial link (your own UART over light), LCD dashboard |
| 12 | Where Does the Power Go? | The Uno's current in 4 power modes, battery maths |
| C1 | The Bench Meter | Volts / ohms / capacitance / frequency meter on an LCD |
| C2 | Poor Man's Oscilloscope | Fast ADC, trigger, timebase, aliasing |

## Folders

```
src/module.yaml          title, hardware list, safety rules, points per task type
src/units/u00…u12.yaml   one file per unit: theory, labs (steps + tasks), quiz, key facts
src/capstones.yaml       the two capstone builds
src/final_exam.yaml      the final exam (grouped into 2-, 3- and 4-point parts)
sketches/<name>/<name>.ino   Arduino code, embedded into the lessons
assets/diagrams/*.svg    schematics (drawn by tools/diagrams.py)
tools/build.py           src → modules/arduino-bench/ in Shelly's module format
tools/validate.py        re-computes every numeric answer from its formula
tools/diagrams.py        redraws the schematics (pip install schemdraw)
```

## Rebuild after editing

From the repo root:

```bash
pip install pyyaml
python3 modules-src/arduino-bench/tools/validate.py     # answers match their formulas
python3 modules-src/arduino-bench/tools/build.py        # → modules/arduino-bench/
python3 tools/build.py check                            # Shelly's own module check
python3 tools/build.py modules                          # → downloads/modules/arduino-bench.zip
```

## How the course maps onto Shelly's format

- Course unit → Shelly unit. Its **Theory** lesson holds the study text, schematics, a formula sheet and the key facts, and its practice test is the unit quiz.
- Each lab → a **Lab** lesson. It has parts, schematic, a wiring table, the sketch as a `code` block with Copy, numbered steps, what you should see, troubleshooting and challenges. Its practice test asks the lab's predictions, measurements and observation questions in order.
- Final exam → a Shelly exam on the `bench` scale: 70 = Bench License, 90 = with distinction.

How the task types map:

| Source type | Shelly type |
|---|---|
| `mcq`, `truefalse` | `choice` |
| `codeline` (tap the buggy line) | `choice` with the numbered code in the prompt |
| `numeric`, `measure`, `resistor` | `number` with `tolerance` (a relative % is turned into ± absolute) and `unit` |
| `multi`, `order` | same, with partial credit |
| `match`, `fill` | `match`, `text` |
| `record` | a "Write down" step in the lesson (not graded) |

Task ids are stable (`u03.quiz.7`, `u03.lab2.s4`, `exam.12`) because Shelly stores progress by task id. If you reorder tasks, raise `version` in `src/module.yaml`.
