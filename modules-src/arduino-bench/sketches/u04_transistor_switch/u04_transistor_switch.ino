// Arduino Bench — Unit 4: Transistor as a switch (and PWM power control)
//
// D9 --[R_BASE]--> NPN base. Emitter -> GND. Collector -> load -> +5 V supply.
// Load A: LED bank (4 LEDs, each with its own 220 ohm resistor, in parallel)
// Load B: small DC motor with a 1N4007 flyback diode across it (stripe to +)
//
// Serial commands (115200):
//   0..9 -> PWM duty 0 %..100 %
//   o    -> off,   f -> full on
//   b    -> blink once a second (for measuring V_CE on/off with the meter)
//   r    -> slow ramp up and down

const byte BASE_PIN = 9;
enum Mode { FIXED, BLINK, RAMP };
Mode mode = FIXED;
byte duty = 0;

void setDuty(byte d) {
  duty = d;
  analogWrite(BASE_PIN, duty);
  Serial.print(F("duty = "));
  Serial.print(duty * 100 / 255);
  Serial.println(F(" %"));
}

void setup() {
  Serial.begin(115200);
  pinMode(BASE_PIN, OUTPUT);
  setDuty(0);
  Serial.println(F("0-9 duty | o off | f full | b blink | r ramp"));
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c >= '0' && c <= '9') { mode = FIXED; setDuty((c - '0') * 255 / 9); }
    else if (c == 'o') { mode = FIXED; setDuty(0); }
    else if (c == 'f') { mode = FIXED; setDuty(255); }
    else if (c == 'b') { mode = BLINK; Serial.println(F("blink")); }
    else if (c == 'r') { mode = RAMP; Serial.println(F("ramp")); }
  }

  if (mode == BLINK) {
    digitalWrite(BASE_PIN, (millis() / 1000) % 2 ? HIGH : LOW);
  } else if (mode == RAMP) {
    // triangle wave, 0 -> 255 -> 0 over ~5 s
    unsigned int t = (millis() / 10) % 510;
    analogWrite(BASE_PIN, t < 255 ? t : 510 - t);
  }
}
