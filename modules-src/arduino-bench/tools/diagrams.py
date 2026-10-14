"""Draws every schematic in the Arduino Bench module.

    python3 tools/diagrams.py            -> assets/diagrams/*.svg   (shipped)
    python3 tools/diagrams.py --png DIR  -> PNG previews for checking

Arduino pins are drawn as open circles labelled with the pin name.
"""
import os
import re
import sys

import schemdraw
import schemdraw.elements as elm

PNG_DIR = None
if "--png" in sys.argv:
    PNG_DIR = sys.argv[sys.argv.index("--png") + 1]
    schemdraw.use("matplotlib")
else:
    schemdraw.use("svg")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "diagrams")
os.makedirs(OUT, exist_ok=True)

DRAWINGS = {}


def drawing(name):
    def deco(fn):
        DRAWINGS[name] = fn
        return fn
    return deco


def new():
    d = schemdraw.Drawing(show=False)
    d.config(fontsize=13, unit=2.5, lw=1.6)
    return d


def pin(d, label, loc="left"):
    """Open circle = a pin on the Arduino."""
    d += elm.Dot(open=True).label(label, loc=loc)


# ---------------------------------------------------------------- Unit 1
@drawing("u01_dividers")
def u01(d):
    d += elm.Vdd().label("5V")
    d += elm.Resistor().down().label("R1\n10 kΩ", loc="bottom")
    d += (n := elm.Dot())
    d += elm.Line().right(1.2).at(n.center)
    pin(d, "A0", "right")
    d += elm.Resistor().down().at(n.center).label("R2\n10 kΩ", loc="bottom")
    d += elm.Ground()

    d += elm.Vdd().at((6, 0)).label("5V")
    d += elm.Resistor().down().label("R3\n1 MΩ", loc="bottom")
    d += (m := elm.Dot())
    d += elm.Line().right(1.2).at(m.center)
    pin(d, "A1", "right")
    d += elm.Resistor().down().at(m.center).label("R4\n1 MΩ", loc="bottom")
    d += elm.Ground()


# ---------------------------------------------------------------- Unit 2
@drawing("u02_iv_tracer")
def u02(d):
    d += elm.Vdd().label("5V")
    d += (pot := elm.Potentiometer().down().label("10 kΩ\npot", loc="top"))
    d += elm.Ground()
    d += elm.Line().right(2.0).at(pot.tap)
    d += (a0 := elm.Dot())
    d += elm.Line().up(1.2).at(a0.center)
    pin(d, "A0", "top")
    d += elm.Resistor().right().at(a0.center).label("R_SENSE\n220 Ω", loc="bottom")
    d += (a1 := elm.Dot())
    d += elm.Line().up(1.2).at(a1.center)
    pin(d, "A1", "top")
    d += elm.LED().down().at(a1.center).label("LED\nunder test", loc="bottom")
    d += elm.Ground()


# ---------------------------------------------------------------- Unit 3
@drawing("u03_cap_meter")
def u03a(d):
    d += elm.Dot(open=True).at((0, 0)).label("D8", loc="left")
    d += elm.Resistor().right().label("R_CHARGE\n10 kΩ / 1 MΩ")
    d += (top := elm.Dot())
    d += elm.Line().right(1.2).at(top.center)
    pin(d, "A0", "right")
    d += elm.Line().down(1.5).at(top.center)
    d += (mid := elm.Dot())
    d += elm.Capacitor(polar=True).down().label("C under test\n(+ up)", loc="bottom")
    d += elm.Ground()
    d += elm.Dot(open=True).at((0, -1.5)).label("D9", loc="left")
    d += elm.Resistor().right().to(mid.center).label("220 Ω", loc="bottom")


@drawing("u03_rc_dac")
def u03b(d):
    d += elm.Dot(open=True).label("D9 (PWM)", loc="left")
    d += elm.Resistor().right().label("R\n10 kΩ → 1 kΩ")
    d += (n := elm.Dot())
    d += elm.Line().right(1.2).at(n.center)
    pin(d, "A0", "right")
    d += elm.Capacitor(polar=True).down().at(n.center).label("10 µF", loc="bottom")
    d += elm.Ground()


# ---------------------------------------------------------------- Unit 4
@drawing("u04_led_bank")
def u04a(d):
    d += (q := elm.BjtNpn(circle=True).label("NPN\nPN2222 / S8050", loc="right"))
    d += elm.Ground().at(q.emitter)
    d += elm.Resistor().left().at(q.base).label("R_B 1 kΩ")
    pin(d, "D9", "left")
    d += elm.Line().up(1.0).at(q.collector)
    d += (bus := elm.Dot())
    xs = [-2.4, -0.8, 0.8, 2.4]
    cx, cy = bus.center
    d += elm.Line().at((cx + xs[0], cy)).to((cx + xs[-1], cy))
    for i, dx in enumerate(xs):
        x = cx + dx
        d += elm.LED().up().at((x, cy)).reverse().length(1.8)
        d += elm.Resistor().up().length(2.2).label("220 Ω" if i == 0 else "", loc="bottom")
        if i == 0:
            top_left = (x, cy + 4.0)
    d += elm.Line().at(top_left).to((cx + xs[-1], cy + 4.0))
    d += elm.Line().up(0.6).at((cx, cy + 4.0))
    d += elm.Vdd().label("+5 V (power module)")


@drawing("u04_motor")
def u04b(d):
    d += (q := elm.BjtNpn(circle=True).label("NPN\nPN2222 / S8050", loc="right"))
    d += elm.Ground().at(q.emitter)
    d += elm.Resistor().left().at(q.base).label("R_B 220 Ω … 1 kΩ")
    pin(d, "D9", "left")
    d += elm.Line().up(0.8).at(q.collector)
    d += (bot := elm.Dot())
    d += elm.Motor().up().label("DC\nmotor", loc="top")
    d += (top := elm.Dot())
    d += elm.Line().up(0.8)
    d += elm.Vdd().label("+5 V motor supply")
    d += elm.Line().right(2.0).at(bot.center)
    d += elm.Diode().up().toy(top.center).label("1N4007\nflyback\n(stripe up)", loc="bottom", ofst=0.3)
    d += elm.Line().left().to(top.center)


# ---------------------------------------------------------------- Unit 5
@drawing("u05_button")
def u05(d):
    d += elm.Vdd().label("5V (inside the chip)")
    d += elm.Resistor().down().label("internal pull-up\n~20–50 kΩ", loc="bottom").linestyle("--")
    d += (n := elm.Dot())
    d += elm.Line().left(1.5).at(n.center)
    pin(d, "D2", "left")
    d += elm.Button().down().at(n.center).label("push\nbutton", loc="bottom")
    d += (g := elm.Ground())
    d += elm.Line().right(2.2).at(n.center)
    d += elm.Capacitor().down().label("100 nF\n(optional RC\ndebounce)", loc="bottom").linestyle("--")
    d += elm.Ground()

    d += elm.Dot(open=True).at((7.5, 0)).label("D8", loc="left")
    d += elm.Resistor().right().label("220 Ω")
    d += elm.LED().down()
    d += elm.Ground()


# ---------------------------------------------------------------- Unit 6
@drawing("u06_595")
def u06(d):
    P = elm.IcPin
    ic = elm.Ic(
        pins=[
            P(name="/MR", pin="10", side="left"),
            P(name="/OE", pin="13", side="left"),
            P(name="STCP", pin="12", side="left"),
            P(name="SHCP", pin="11", side="left"),
            P(name="DS", pin="14", side="left"),
            P(name="Q7", pin="7", side="right"),
            P(name="Q6", pin="6", side="right"),
            P(name="Q5", pin="5", side="right"),
            P(name="Q4", pin="4", side="right"),
            P(name="Q3", pin="3", side="right"),
            P(name="Q2", pin="2", side="right"),
            P(name="Q1", pin="1", side="right"),
            P(name="Q0", pin="15", side="right"),
            P(name="VCC", pin="16", side="top"),
            P(name="GND", pin="8", side="bottom"),
        ],
        edgepadW=2.2, edgepadH=0.5, pinspacing=1.0, leadlen=0.8,
    ).label("74HC595", loc="center")
    d += ic
    for name, ard in [("DS", "D11"), ("SHCP", "D12"), ("STCP", "D8"), ("/OE", "D9 (PWM)")]:
        d += elm.Line().left(1.0).at(ic.absanchors[name])
        pin(d, ard, "left")
    d += elm.Line().left(1.0).at(ic.absanchors["/MR"])
    pin(d, "5V", "left")
    d += elm.Ground().at(ic.absanchors["GND"])
    d += elm.Line().up(0.6).at(ic.absanchors["VCC"])
    d += (vcc := elm.Dot())
    d += elm.Vdd().label("5V")
    d += elm.Capacitor().right().at(vcc.center).length(1.6).label("100 nF", loc="top")
    d += elm.Ground()
    ends = []
    for i in range(8):  # Q0 at the top
        a = ic.absanchors[f"Q{i}"]
        d += elm.Resistor().right().at(a).length(1.8).label("1 kΩ" if i == 0 else "", loc="top")
        d += elm.LED().right().length(1.4)
        ends.append(d.here)
    d += elm.Line().at(ends[0]).to(ends[-1])
    d += elm.Ground().at(ends[-1])


# ---------------------------------------------------------------- Unit 7
@drawing("u07_thermistor")
def u07a(d):
    d += elm.Vdd().label("5V")
    d += elm.Resistor().down().label("R_FIXED\n10 kΩ", loc="bottom")
    d += (n := elm.Dot())
    d += elm.Line().right(1.2).at(n.center)
    pin(d, "A0", "right")
    d += elm.Thermistor().down().at(n.center).label("NTC\n10 kΩ @25 °C", loc="bottom")
    d += elm.Ground()


@drawing("u07_night_light")
def u07b(d):
    d += elm.Vdd().label("5V")
    d += elm.Photoresistor().down().label("LDR", loc="bottom")
    d += (n := elm.Dot())
    d += elm.Line().right(1.2).at(n.center)
    pin(d, "A0", "right")
    d += elm.Resistor().down().at(n.center).label("10 kΩ", loc="bottom")
    d += elm.Ground()

    d += elm.Dot(open=True).at((5.5, -1.5)).label("D9", loc="left")
    d += elm.Resistor().right().label("220 Ω")
    d += elm.LED().down()
    d += elm.Ground()


# ---------------------------------------------------------------- Unit 8
@drawing("u08_sonar")
def u08(d):
    P = elm.IcPin
    s = elm.Ic(pins=[P(name="GND", side="left"), P(name="Echo", side="left"),
                     P(name="Trig", side="left"), P(name="VCC", side="left")],
               edgepadW=1.2, pinspacing=0.9).label("HC-SR04", loc="center")
    d += s
    d += elm.Line().left(1.2).at(s.absanchors["VCC"])
    pin(d, "5V", "left")
    d += elm.Line().left(1.2).at(s.absanchors["Trig"])
    pin(d, "D7", "left")
    d += elm.Line().left(1.2).at(s.absanchors["Echo"])
    pin(d, "D6", "left")
    d += elm.Line().left(1.2).at(s.absanchors["GND"])
    d += elm.Ground()

    d += elm.Dot(open=True).at((-1.7, -3.2)).label("D8", loc="left")
    d += elm.Resistor().right().label("100 Ω (volume)")
    d += elm.Speaker().right().label("passive\nbuzzer", loc="right")
    d += elm.Ground().at(d.here)


# ---------------------------------------------------------------- Unit 9
@drawing("u09_555")
def u09(d):
    T = elm.Ic555()
    d += T
    bot = elm.Ground().at(T.GND)
    d += bot
    d += elm.Dot()
    d += elm.Resistor().endpoints(T.DIS, T.THR).label("R2 10 kΩ").idot()
    d += elm.Resistor().up().at(T.DIS).label("R1 1 kΩ").label("+5V", "right")
    d += elm.Line().endpoints(T.THR, T.TRG)
    d += elm.Capacitor().at(T.TRG).toy(bot.start).label("C\n10 µF (slow)\n100 nF (fast)", loc="top").dot()
    d += elm.Line().tox(bot.start)
    d += elm.Capacitor().at(T.CTL).toy(bot.start).label("10 nF", loc="bottom").dot()
    d += elm.Dot().at(T.DIS)
    d += elm.Dot().at(T.THR)
    d += elm.Dot().at(T.TRG)
    d += elm.Line().endpoints(T.RST, T.Vcc).dot()
    d += elm.Line().up(d.unit / 4).label("+5V", "right")
    d += elm.Line().right(0.8).at(T.OUT)
    d += (o := elm.Dot())
    d += elm.Resistor().right().label("330 Ω")
    d += elm.LED().down().toy(bot.start)
    d += elm.Line().tox(bot.start)
    d += elm.Line().up(1.6).at(o.center)
    pin(d, "D2  (freq. counter)", "top")


# ---------------------------------------------------------------- Unit 10
@drawing("u10_hbridge")
def u10a(d):
    P = elm.IcPin
    ic = elm.Ic(
        pins=[
            P(name="2A", pin="7", side="left"),
            P(name="1A", pin="2", side="left"),
            P(name="EN1,2", pin="1", side="left"),
            P(name="2Y", pin="6", side="right"),
            P(name="1Y", pin="3", side="right"),
            P(name="VCC1", pin="16", side="top"),
            P(name="VCC2", pin="8", side="top"),
            P(name="GND", pin="4,5,12,13", side="bottom"),
        ],
        edgepadW=2.4, edgepadH=0.6, pinspacing=1.2, leadlen=0.8,
    ).label("L293D", loc="center")
    d += ic
    for name, ard in [("EN1,2", "D5 (PWM)"), ("1A", "D4"), ("2A", "D3")]:
        d += elm.Line().left(1.0).at(ic.absanchors[name])
        pin(d, ard, "left")
    d += elm.Ground().at(ic.absanchors["GND"])
    d += elm.Line().up(0.8).at(ic.absanchors["VCC1"])
    d += elm.Vdd().label("5V logic")
    d += elm.Line().up(0.8).at(ic.absanchors["VCC2"])
    d += elm.Vdd().label("motor supply", loc="right")
    d += elm.Line().right(1.2).at(ic.absanchors["1Y"])
    d += elm.Motor().down().toy(ic.absanchors["2Y"]).label("M", loc="bottom")
    d += elm.Line().left().to(ic.absanchors["2Y"])

    d += elm.Vdd().at((-6.5, -3.4)).label("5V")
    d += (pot := elm.Potentiometer().down().label("10 kΩ", loc="top"))
    d += elm.Ground()
    d += elm.Line().right(1.5).at(pot.tap)
    pin(d, "A0", "right")


@drawing("u10_sun_tracker")
def u10b(d):
    for x, a, name in [(0, "A0", "LDR left"), (4.5, "A1", "LDR right")]:
        d += elm.Vdd().at((x, 0)).label("5V")
        d += elm.Photoresistor().down().label(name, loc="bottom")
        d += (n := elm.Dot())
        d += elm.Line().right(1.2).at(n.center)
        pin(d, a, "right")
        d += elm.Resistor().down().at(n.center).label("10 kΩ", loc="bottom")
        d += elm.Ground()
    P = elm.IcPin
    s = elm.Ic(pins=[P(name="GND", side="left"), P(name="+5V", side="left"), P(name="SIG", side="left")],
               edgepadW=1.6, pinspacing=1.1, leadlen=0.8).label("SG90\nservo", loc="center").right().at((12.5, -4.0))
    d += s
    d += elm.Line().left(1.0).at(s.absanchors["SIG"])
    pin(d, "D9", "left")
    d += elm.Line().left(2.2).at(s.absanchors["+5V"])
    d += (pv := elm.Dot())
    d += elm.Vdd().label("5V")
    d += elm.Line().left(2.2).at(s.absanchors["GND"])
    d += (pg := elm.Dot())
    d += elm.Ground()
    d += elm.Capacitor(polar=True).endpoints(pv.center, pg.center).label("470 µF", loc="top")


@drawing("u10_stepper")
def u10c(d):
    P = elm.IcPin
    s = elm.Ic(pins=[P(name="IN4", side="left"), P(name="IN3", side="left"),
                     P(name="IN2", side="left"), P(name="IN1", side="left"),
                     P(name="+", side="top"), P(name="−", side="bottom"),
                     P(name="OUT", side="right")],
               edgepadW=2.6, pinspacing=0.8).label("ULN2003\nboard", loc="center")
    d += s
    for name, ard in [("IN1", "D8"), ("IN2", "D9"), ("IN3", "D10"), ("IN4", "D11")]:
        d += elm.Line().left(1.0).at(s.absanchors[name])
        pin(d, ard, "left")
    d += elm.Line().up(0.6).at(s.absanchors["+"])
    d += elm.Vdd().label("external 5V")
    d += elm.Ground().at(s.absanchors["−"])
    d += elm.Line().right(1.0).at(s.absanchors["OUT"])
    d += elm.Motor().right().label("28BYJ-48", loc="top")


# ---------------------------------------------------------------- Unit 11
@drawing("u11_light_link")
def u11a(d):
    d += elm.Dot(open=True).at((0, 0)).label("D7  (TX)", loc="left")
    d += elm.Resistor().right().label("220 Ω")
    d += elm.LED().down().label("TX LED", loc="top")
    d += elm.Ground()
    d += elm.Vdd().at((5.2, 0.8)).label("5V")
    d += elm.Photoresistor().down().label("LDR\n(faces LED)", loc="bottom")
    d += (n := elm.Dot())
    d += elm.Line().right(1.2).at(n.center)
    pin(d, "A0  (RX)", "right")
    d += elm.Resistor().down().at(n.center).label("10 kΩ", loc="bottom")
    d += elm.Ground()
    d += elm.Arrow(lw=1.2).at((3.1, -1.25)).to((4.7, -0.55)).color("#c77700")
    d += elm.Label().at((3.9, -2.1)).label("light\n(shield it)")


@drawing("u11_lcd")
def u11b(d):
    P = elm.IcPin
    names = [("VSS", "1"), ("VDD", "2"), ("V0", "3"), ("RS", "4"), ("RW", "5"), ("E", "6"),
             ("D4", "11"), ("D5", "12"), ("D6", "13"), ("D7", "14"), ("A", "15"), ("K", "16")]
    lcd = elm.Ic(pins=[P(name=n, pin=p, side="right") for n, p in reversed(names)],
                 edgepadW=1.6, pinspacing=0.9, leadlen=0.8).label("LCD1602\n(D0–D3\nunused)", loc="center")
    d += lcd
    A = lcd.absanchors
    for n, ard in [("VSS", "GND"), ("VDD", "5V"), ("RS", "D12"), ("RW", "GND"), ("E", "D11"),
                   ("D4", "D5"), ("D5", "D4"), ("D6", "D3"), ("D7", "D2")]:
        d += elm.Line().right(1.0).at(A[n])
        pin(d, ard, "right")
    d += elm.Line().right(1.0).at(A["A"])
    d += elm.Resistor().right().length(2.0).label("220 Ω", loc="bottom")
    pin(d, "5V", "right")
    d += elm.Line().right(4.6).at(A["K"])
    pin(d, "GND", "right")
    # contrast pot: ends to GND / 5V, WIPER to V0
    vx, vy = A["V0"]
    d += (pot := elm.Potentiometer().right().flip().at((vx + 3.0, vy + 2.6)).label("10 kΩ contrast pot", loc="top"))
    d += elm.Line().left(0.5).at(pot.start)
    pin(d, "GND", "left")
    d += elm.Line().right(0.5).at(pot.end)
    pin(d, "5V", "right")
    d += elm.Line().at(A["V0"]).tox(pot.tap)
    d += elm.Line().toy(pot.tap)


# ---------------------------------------------------------------- Unit 12
@drawing("u12_power")
def u12(d):
    d += (b := elm.Battery().up().label("9 V", loc="bottom").reverse())
    d += elm.Line().up(0.6)
    d += elm.MeterA().right().label("multimeter\n(mA range)", loc="top")
    d += elm.Line().right(0.6)
    pin(d, "Uno VIN", "right")
    d += elm.Line().down(0.6).at(b.start)
    d += elm.Line().right(5.6)
    pin(d, "Uno GND", "right")
    d += elm.Dot(open=True).at((9.5, 2.0)).label("D2", loc="left")
    d += elm.Button().right().label("mode")
    d += elm.Ground()


# ------------------------------------------------------------- Capstones
@drawing("c1_front_end")
def c1(d):
    # VOLT
    d += elm.Dot(open=True).at((0, 0)).label("V probe +", loc="top")
    d += elm.Resistor().down().label("30 kΩ\n(3 × 10 kΩ)", loc="bottom")
    d += (n := elm.Dot())
    d += elm.Line().right(1.0).at(n.center)
    pin(d, "A0", "right")
    d += elm.Resistor().down().at(n.center).label("10 kΩ", loc="bottom")
    d += elm.Ground()
    # OHM
    d += elm.Vdd().at((5, 0)).label("5V")
    d += elm.Resistor().down().label("R_REF\n10 kΩ", loc="bottom")
    d += (m := elm.Dot())
    d += elm.Line().right(1.0).at(m.center)
    pin(d, "A2", "right")
    d += elm.Resistor().down().at(m.center).label("Rx\n(probes)", loc="bottom").linestyle("--")
    d += elm.Ground()
    # CAP
    d += elm.Dot(open=True).at((10.0, 0)).label("D8", loc="top")
    d += elm.Resistor().right().label("10 kΩ")
    d += (top := elm.Dot())
    d += elm.Line().right(1.0).at(top.center)
    pin(d, "A1", "right")
    d += elm.Line().down(1.5).at(top.center)
    d += (mid := elm.Dot())
    d += elm.Capacitor(polar=True).down().label("Cx", loc="bottom")
    d += elm.Ground()
    d += elm.Dot(open=True).at((10.0, -1.5)).label("D9", loc="left")
    d += elm.Resistor().right().to(mid.center).label("220 Ω", loc="bottom")
    # FREQ + button + buzzer
    d += elm.Dot(open=True).at((0, -7.2)).label("signal in\n0–5 V", loc="left")
    d += elm.Line().right(2.0)
    pin(d, "D2", "right")
    d += elm.Dot(open=True).at((5, -7.2)).label("D3", loc="left")
    d += elm.Button().right().label("mode")
    d += elm.Ground()
    d += elm.Dot(open=True).at((10.0, -7.2)).label("D10", loc="left")
    d += elm.Speaker().right().label("buzzer", loc="top")
    d += elm.Ground().at(d.here)


@drawing("c2_scope")
def c2(d):
    d += elm.Dot(open=True).at((0, 0)).label("probe tip\n(0–5 V only!)", loc="left")
    d += elm.Resistor().right().label("1 kΩ")
    d += (n := elm.Dot())
    d += elm.Line().right(1.2)
    pin(d, "A0", "right")
    d += elm.Dot(open=True).at((0, -2.0)).label("D5 test tone", loc="left")
    d += elm.Resistor().right().label("1 kΩ", loc="bottom")
    d += elm.Line().up().to(n.center).linestyle("--")
    d += elm.Dot(open=True).at((0, -4.0)).label("probe ground", loc="left")
    d += elm.Line().right(2.5)
    pin(d, "GND", "right")


# ---------------------------------------------------------------- render
BG = '<rect x="0" y="0" width="100%" height="100%" fill="#ffffff"/>'


def render(name, fn):
    d = new()
    fn(d)
    if PNG_DIR:
        os.makedirs(PNG_DIR, exist_ok=True)
        d.save(os.path.join(PNG_DIR, name + ".png"), dpi=90)
        return
    path = os.path.join(OUT, name + ".svg")
    d.save(path)
    svg = open(path, encoding="utf-8").read()
    # white card so the schematic reads in dark mode too (cover the whole viewBox,
    # whose origin is usually negative)
    vb = re.search(r'viewBox="([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)"', svg)
    x, y, w, h = (float(v) for v in vb.groups())
    pad = 8
    bg = (f'<rect x="{x - pad}" y="{y - pad}" width="{w + 2 * pad}" height="{h + 2 * pad}" '
          f'rx="10" fill="#ffffff"/>')
    root = re.search(r"<svg[^>]*>", svg).group(0)
    new_root = root.replace(vb.group(0), f'viewBox="{x - pad} {y - pad} {w + 2 * pad} {h + 2 * pad}"')
    # drop fixed width/height on the root only, so the app can scale the picture
    new_root = re.sub(r'\s(width|height)="[^"]*"', "", new_root)
    svg = svg.replace(root, new_root + bg, 1)
    open(path, "w", encoding="utf-8").write(svg)


if __name__ == "__main__":
    only = [a for a in sys.argv[1:] if not a.startswith("--") and a != PNG_DIR]
    for name, fn in DRAWINGS.items():
        if only and name not in only:
            continue
        try:
            render(name, fn)
            print("ok  ", name)
        except Exception as exc:  # keep going, report all failures
            print("FAIL", name, type(exc).__name__, exc)
