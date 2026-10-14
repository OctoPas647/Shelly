// Arduino Bench — Capstone 1: The Bench Meter
// A 4-mode instrument on an LCD1602: Volts, Ohms (+continuity beep),
// Capacitance and Frequency. Every mode is a circuit you built earlier.
//
// LCD:  RS->D12, E->D11, D4->D4, D5->D5, D6->D6, D7->D7  (RW->GND, V0->pot)
// Mode button: D3 -> GND
// VOLT : probe+ --[30k (3x10k)]--+-- A0 --[10k]-- GND     (max 20 V, DC, positive only!)
// OHM  : 5V --[10k ref]--+-- A2 -- probe ... Rx ... -- GND
// CAP  : D8 --[10k]--+-- A1 ;  D9 --[220]--+ ;  capacitor between A1 node and GND
// FREQ : signal (0..5 V) -> D2
// Buzzer (passive): D10 -> buzzer -> GND

#include <LiquidCrystal.h>

LiquidCrystal lcd(12, 11, 4, 5, 6, 7);

const byte MODE_BTN = 3;
const byte FREQ_PIN = 2;
const byte CHARGE_PIN = 8;
const byte DISCHARGE_PIN = 9;
const byte BUZZER_PIN = 10;

// ---- calibration: measure your parts and enter the real values ----
const float DIVIDER_RATIO = 4.0;     // (R_top + R_bottom) / R_bottom
const float R_REF = 10000.0;         // ohmmeter reference resistor
const float R_CHARGE = 10000.0;      // capacitance charge resistor
long BANDGAP_mV = 1100;              // from your Unit 1 calibration

enum Mode { VOLT, OHM, CAP, FREQ, MODE_COUNT };
Mode mode = VOLT;
const char* const MODE_NAMES[] = {"VOLTS  (A0)", "OHMS   (A2)", "CAP    (A1)", "FREQ   (D2)"};

volatile unsigned long edges = 0;
void onRise() { edges++; }

long readVcc_mV() {
  ADMUX = _BV(REFS0) | _BV(MUX3) | _BV(MUX2) | _BV(MUX1);
  delay(2);
  ADCSRA |= _BV(ADSC);
  while (bit_is_set(ADCSRA, ADSC)) {}
  return (BANDGAP_mV * 1024L) / ADC;
}

int readAvg(byte pin) {
  analogRead(pin);
  long s = 0;
  for (byte i = 0; i < 16; i++) s += analogRead(pin);
  return s / 16;
}

void showValue(float value, byte decimals, const __FlashStringHelper* unit) {
  lcd.setCursor(0, 1);
  lcd.print(value, decimals);
  lcd.print(' ');
  lcd.print(unit);
  lcd.print(F("          "));
}

void showText(const __FlashStringHelper* text) {
  lcd.setCursor(0, 1);
  lcd.print(text);
  lcd.print(F("          "));
}

void measureVolts() {
  float vcc = readVcc_mV() / 1000.0;
  float v = readAvg(A0) * vcc / 1024.0 * DIVIDER_RATIO;
  showValue(v, 2, F("V"));
  delay(200);
}

void measureOhms() {
  int a = readAvg(A2);
  if (a >= 1015) { noTone(BUZZER_PIN); showText(F("OPEN")); delay(100); return; }
  float r = R_REF * a / (1024.0 - a);       // ratiometric: Vcc cancels
  if (r < 50) tone(BUZZER_PIN, 2000); else noTone(BUZZER_PIN);
  if (r >= 1000) showValue(r / 1000.0, 2, F("kOhm"));
  else showValue(r, 0, F("Ohm"));
  delay(100);
}

void measureCap() {
  digitalWrite(CHARGE_PIN, LOW);
  pinMode(DISCHARGE_PIN, OUTPUT);
  digitalWrite(DISCHARGE_PIN, LOW);
  unsigned long t0 = millis();
  while (analogRead(A1) > 1 && millis() - t0 < 5000) {}
  delay(50);
  pinMode(DISCHARGE_PIN, INPUT);

  unsigned long start = micros();
  digitalWrite(CHARGE_PIN, HIGH);
  bool timeout = false;
  while (analogRead(A1) < 647) {
    if (micros() - start > 5000000UL) { timeout = true; break; }
    if (digitalRead(MODE_BTN) == LOW) break;  // stay responsive
  }
  unsigned long tau = micros() - start;
  digitalWrite(CHARGE_PIN, LOW);

  float uF = tau / R_CHARGE;
  if (timeout) showText(F("> 500 uF / open"));
  else if (uF >= 1.0) showValue(uF, 2, F("uF"));
  else showValue(uF * 1000.0, 0, F("nF"));
  delay(300);
}

void measureFreq() {
  noInterrupts(); edges = 0; interrupts();
  attachInterrupt(digitalPinToInterrupt(FREQ_PIN), onRise, RISING);
  unsigned long t0 = millis();
  while (millis() - t0 < 1000) {
    if (digitalRead(MODE_BTN) == LOW) break;
  }
  detachInterrupt(digitalPinToInterrupt(FREQ_PIN));
  noInterrupts(); unsigned long n = edges; interrupts();

  if (n >= 100) {                      // fast: gate count, +-1 Hz is < 1 %
    showValue(n, 0, F("Hz (gate)"));
  } else {                             // slow: measure the period instead
    unsigned long hi = pulseIn(FREQ_PIN, HIGH, 2000000UL);
    unsigned long lo = pulseIn(FREQ_PIN, LOW, 2000000UL);
    if (hi && lo) showValue(1e6 / (hi + lo), 3, F("Hz (period)"));
    else showText(F("no signal"));
  }
}

void setMode(Mode m) {
  mode = m;
  noTone(BUZZER_PIN);
  lcd.clear();
  lcd.print(MODE_NAMES[mode]);
}

void setup() {
  lcd.begin(16, 2);
  pinMode(MODE_BTN, INPUT_PULLUP);
  pinMode(FREQ_PIN, INPUT);
  pinMode(CHARGE_PIN, OUTPUT);
  digitalWrite(CHARGE_PIN, LOW);
  pinMode(DISCHARGE_PIN, INPUT);
  lcd.print(F("Arduino Bench"));
  lcd.setCursor(0, 1);
  lcd.print(F("Bench Meter v1"));
  delay(1200);
  setMode(VOLT);
}

void loop() {
  if (digitalRead(MODE_BTN) == LOW) {
    delay(30);
    if (digitalRead(MODE_BTN) == LOW) {
      setMode((Mode)((mode + 1) % MODE_COUNT));
      while (digitalRead(MODE_BTN) == LOW) {}
      delay(30);
    }
  }

  switch (mode) {
    case VOLT: measureVolts(); break;
    case OHM:  measureOhms();  break;
    case CAP:  measureCap();   break;
    case FREQ: measureFreq();  break;
    default: break;
  }
}
