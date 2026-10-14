// Arduino Bench — Unit 3: Capacitance Meter (RC time constant)
//
// D8 --[R_CHARGE]--+-- A0
//                  |
// D9 --[220 ohm]---+
//                  |
//                [C under test]  (+ leg to this node for electrolytics)
//                  |
//                 GND
//
// Physics: charging through R, the capacitor reaches 63.2 % of the supply
// after exactly one time constant tau = R*C.  So  C = tau / R.
// With tau in microseconds and R in ohms, the answer comes out in microfarads.
//
// Use R_CHARGE = 10k for 1 uF .. 1000 uF and 1M for 1 nF .. 1 uF.

const byte CHARGE_PIN = 8;
const byte DISCHARGE_PIN = 9;
const byte SENSE_PIN = A0;
const float R_CHARGE = 10000.0;     // ohms - measure yours and type the real value
const int THRESHOLD = 647;          // 63.2 % of 1024
const unsigned long TIMEOUT_US = 15000000UL;  // 15 s

void dischargeCap() {
  digitalWrite(CHARGE_PIN, LOW);
  pinMode(DISCHARGE_PIN, OUTPUT);
  digitalWrite(DISCHARGE_PIN, LOW);
  unsigned long t0 = millis();
  while (analogRead(SENSE_PIN) > 1 && millis() - t0 < 10000) {}
  delay(50);                        // a little extra to really empty it
  pinMode(DISCHARGE_PIN, INPUT);    // high impedance: out of the circuit
}

void setup() {
  Serial.begin(115200);
  pinMode(CHARGE_PIN, OUTPUT);
  digitalWrite(CHARGE_PIN, LOW);
  pinMode(DISCHARGE_PIN, INPUT);
  Serial.println(F("Capacitance meter. Insert a capacitor (watch polarity)."));
}

void loop() {
  dischargeCap();

  unsigned long start = micros();
  digitalWrite(CHARGE_PIN, HIGH);
  while (analogRead(SENSE_PIN) < THRESHOLD) {
    if (micros() - start > TIMEOUT_US) break;
  }
  unsigned long tau = micros() - start;
  digitalWrite(CHARGE_PIN, LOW);

  float uF = tau / R_CHARGE;

  Serial.print(F("tau = "));
  Serial.print(tau);
  Serial.print(F(" us   C = "));
  if (tau >= TIMEOUT_US) {
    Serial.println(F("too big / no connection"));
  } else if (uF >= 1.0) {
    Serial.print(uF, 2);
    Serial.println(F(" uF"));
  } else {
    Serial.print(uF * 1000.0, 1);
    Serial.println(F(" nF"));
  }
  delay(500);
}
