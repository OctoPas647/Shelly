// Arduino Bench — Capstone 2: Poor Man's Oscilloscope
//
// Probe: signal (0..5 V ONLY) --[1k]-- A0. Common ground.
// Built-in test signal: D5 outputs a square wave (tone()) - wire D5 -> 1k -> A0
// to test, or probe your 555, the RC filter, the LDR...
//
// The ADC normally runs at 125 kHz (prescaler 128) -> ~9.6 k samples/s.
// We drop the prescaler to 16 -> 1 MHz ADC clock -> roughly 50-60 k samples/s.
// The datasheet only promises full 10-bit accuracy up to 200 kHz, so we trade
// a few bits of precision for speed - a real engineering trade-off.
//
// Serial (115200), Serial Plotter for the trace. Commands:
//   + / -  slower / faster timebase       a  auto <-> normal trigger
//   t      cycle the test tone (off, 50, 200, 1000, 3000, 9000 Hz)
//   c      dump the next capture as CSV (time_us,volts) for a spreadsheet

const byte PROBE = A0;
const byte TEST_PIN = 5;
const int N = 400;
const float VCC = 5.0;

int samples[N];
const unsigned int TIMEBASES[] = {0, 20, 50, 100, 200, 500, 1000, 2000};  // extra us between samples
byte tb = 0;
bool autoTrigger = true;
bool csvNext = false;
int triggerLevel = 512;

const unsigned int TONES[] = {0, 50, 200, 1000, 3000, 9000};
byte toneIdx = 3;

void setFastAdc() {
  ADCSRA &= ~(bit(ADPS2) | bit(ADPS1) | bit(ADPS0));
  ADCSRA |= bit(ADPS2);  // ADPS = 100 -> prescaler 16 -> 16 MHz / 16 = 1 MHz
}

void applyTone() {
  if (TONES[toneIdx]) tone(TEST_PIN, TONES[toneIdx]);
  else noTone(TEST_PIN);
}

bool waitForTrigger() {
  // rising edge through triggerLevel: first be below, then go above
  unsigned long t0 = millis();
  while (analogRead(PROBE) >= triggerLevel - 8) { if (millis() - t0 > 100) return false; }
  while (analogRead(PROBE) < triggerLevel + 8)  { if (millis() - t0 > 100) return false; }
  return true;
}

void setup() {
  Serial.begin(115200);
  setFastAdc();
  applyTone();
}

void handleCommands() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '+' && tb < sizeof(TIMEBASES) / sizeof(TIMEBASES[0]) - 1) tb++;
    if (c == '-' && tb > 0) tb--;
    if (c == 'a') autoTrigger = !autoTrigger;
    if (c == 't') { toneIdx = (toneIdx + 1) % (sizeof(TONES) / sizeof(TONES[0])); applyTone(); }
    if (c == 'c') csvNext = true;
  }
}

void loop() {
  handleCommands();

  bool triggered = waitForTrigger();
  if (!triggered && !autoTrigger) return;   // normal mode: no trigger, no trace

  unsigned int extra = TIMEBASES[tb];
  unsigned long t0 = micros();
  for (int i = 0; i < N; i++) {
    samples[i] = analogRead(PROBE);
    if (extra) delayMicroseconds(extra);
  }
  float dtUs = (micros() - t0) / (float)N;   // real time per sample, measured

  // ---- measurements ----
  int lo = 1023, hi = 0;
  long sum = 0;
  for (int i = 0; i < N; i++) { lo = min(lo, samples[i]); hi = max(hi, samples[i]); sum += samples[i]; }
  int mid = (lo + hi) / 2, hyst = max(4, (hi - lo) / 10);
  int firstRise = -1, lastRise = -1, rises = 0, highCount = 0;
  bool above = samples[0] > mid;
  for (int i = 1; i < N; i++) {
    if (samples[i] > mid) highCount++;
    if (!above && samples[i] > mid + hyst) {
      above = true;
      if (firstRise < 0) firstRise = i;
      lastRise = i;
      rises++;
    } else if (above && samples[i] < mid - hyst) {
      above = false;
    }
  }

  // ---- output ----
  if (csvNext) {
    Serial.println(F("time_us,volts"));
    for (int i = 0; i < N; i++) {
      Serial.print(i * dtUs, 1);
      Serial.print(',');
      Serial.println(samples[i] * VCC / 1024.0, 3);
    }
    csvNext = false;
  } else {
    for (int i = 0; i < N; i++) {
      Serial.print(F("volts:"));
      Serial.println(samples[i] * VCC / 1024.0, 2);
    }
  }

  Serial.print(F("# fs="));
  Serial.print(1000.0 / dtUs, 1);
  Serial.print(F(" kS/s  window="));
  Serial.print(N * dtUs / 1000.0, 1);
  Serial.print(F(" ms  Vmin="));
  Serial.print(lo * VCC / 1024.0, 2);
  Serial.print(F(" Vmax="));
  Serial.print(hi * VCC / 1024.0, 2);
  Serial.print(F(" Vavg="));
  Serial.print(sum / (float)N * VCC / 1024.0, 2);
  if (rises >= 2) {
    float periodUs = (lastRise - firstRise) * dtUs / (rises - 1);
    Serial.print(F(" f="));
    Serial.print(1e6 / periodUs, 1);
    Serial.print(F(" Hz duty~"));
    Serial.print(100.0 * highCount / (N - 1), 0);
    Serial.print('%');
  }
  Serial.print(F(" test_tone="));
  Serial.print(TONES[toneIdx]);
  Serial.println(triggered ? F(" Hz [TRIG]") : F(" Hz [AUTO]"));
  delay(300);
}
