// Arduino Bench — Unit 2: LED I-V Curve Tracer
//
// Circuit: pot wiper -> A0 -> R_SENSE (220 ohm) -> A1 -> LED anode, LED cathode -> GND
//   current through LED   I = (V(A0) - V(A1)) / R_SENSE
//   voltage across LED    V = V(A1)
//
// Turn the pot SLOWLY from 0 to max. Each time the LED voltage changes by more
// than STEP_mV a new CSV row is printed. Copy the rows into a spreadsheet and
// make an X-Y scatter chart (X = V_led, Y = I_mA).
//
// Send 'p' for Serial Plotter mode, 'c' for CSV mode, 'r' to reset the sweep.

const float R_SENSE = 220.0;  // measure your resistor with the multimeter!
const float VCC = 5.00;       // measure your 5V pin and put the real value here
const int STEP_mV = 10;
const byte SAMPLES = 8;

bool plotterMode = false;
float lastV = -1.0;
float kneeV = -1.0;  // LED voltage where the current first reaches 1 mA

float readVolts(byte pin) {
  analogRead(pin);
  long sum = 0;
  for (byte i = 0; i < SAMPLES; i++) sum += analogRead(pin);
  return (sum / (float)SAMPLES) * VCC / 1024.0;
}

void resetSweep() {
  lastV = -1.0;
  kneeV = -1.0;
  if (!plotterMode) Serial.println(F("V_led_V,I_mA"));
}

void setup() {
  Serial.begin(115200);
  Serial.println(F("LED I-V tracer. Turn the pot slowly from 0 to max."));
  resetSweep();
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'p') plotterMode = true;
    if (c == 'c') { plotterMode = false; resetSweep(); }
    if (c == 'r') resetSweep();
  }

  float vTop = readVolts(A0);
  float vLed = readVolts(A1);
  float iMa = (vTop - vLed) / R_SENSE * 1000.0;
  if (iMa < 0) iMa = 0;

  if (plotterMode) {
    Serial.print(F("V_led:"));
    Serial.print(vLed, 3);
    Serial.print(F(" I_mA:"));
    Serial.println(iMa, 2);
    delay(20);
    return;
  }

  if (lastV < 0 || fabs(vLed - lastV) * 1000.0 >= STEP_mV) {
    Serial.print(vLed, 3);
    Serial.print(',');
    Serial.println(iMa, 3);
    lastV = vLed;
    if (kneeV < 0 && iMa >= 1.0) {
      kneeV = vLed;
      Serial.print(F("# 1 mA reached at V_led = "));
      Serial.print(kneeV, 3);
      Serial.println(F(" V"));
    }
  }
}
