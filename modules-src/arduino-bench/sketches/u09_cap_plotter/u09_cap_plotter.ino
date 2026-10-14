// Arduino Bench — Unit 9: Watch the 555's timing capacitor
//
// Connect the 555's pin 6/2 node (top of the timing capacitor) to A0.
// Use the SLOW version of the circuit (C = 10 uF, ~7 Hz) so the ADC can
// keep up. Common ground between the 555 and the Arduino!
//
// Serial Plotter shows the capacitor voltage bouncing between the 555's two
// comparator thresholds: 1/3 Vcc and 2/3 Vcc.
// Send 'm' to switch between plotting and a min / max / frequency report.

const float VCC = 5.00;
bool statsMode = false;

void setup() {
  Serial.begin(115200);
}

void plotOnce() {
  float v = analogRead(A0) * VCC / 1024.0;
  Serial.print(F("cap_V:"));
  Serial.print(v, 3);
  Serial.print(F(" one_third:"));
  Serial.print(VCC / 3.0, 3);
  Serial.print(F(" two_thirds:"));
  Serial.println(VCC * 2.0 / 3.0, 3);
  delay(4);
}

void statsOnce() {
  // Sample for 2 seconds, track min/max and count upward crossings of 2.5 V
  int lo = 1023, hi = 0, crossings = 0;
  bool above = analogRead(A0) > 512;
  unsigned long t0 = millis(), firstCross = 0, lastCross = 0;
  while (millis() - t0 < 2000) {
    int a = analogRead(A0);
    lo = min(lo, a);
    hi = max(hi, a);
    if (!above && a > 522) {           // 10-count hysteresis around 512
      above = true;
      lastCross = millis();
      if (crossings == 0) firstCross = lastCross;
      crossings++;
    } else if (above && a < 502) {
      above = false;
    }
  }
  Serial.print(F("min "));
  Serial.print(lo * VCC / 1024.0, 3);
  Serial.print(F(" V   max "));
  Serial.print(hi * VCC / 1024.0, 3);
  Serial.print(F(" V   f = "));
  if (crossings >= 2) {
    Serial.print(1000.0 * (crossings - 1) / (lastCross - firstCross), 2);
    Serial.println(F(" Hz"));
  } else {
    Serial.println(F("? (too slow / not oscillating)"));
  }
}

void loop() {
  if (Serial.available() && Serial.read() == 'm') statsMode = !statsMode;
  if (statsMode) statsOnce();
  else plotOnce();
}
