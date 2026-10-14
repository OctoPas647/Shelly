// Arduino Bench — Unit 9: Frequency counter (two methods)
//
// Signal (0..5 V only!) -> D2.  Common ground.
//
// Method A — period measurement: time one HIGH and one LOW with pulseIn().
//            Great resolution for slow signals, also gives duty cycle.
// Method B — gate counting: count rising edges for exactly 1 s.
//            Resolution is +-1 count = +-1 Hz, so it shines on FAST signals.

const byte SIGNAL_PIN = 2;
volatile unsigned long edgeCount = 0;

void onRise() { edgeCount++; }

void setup() {
  Serial.begin(115200);
  pinMode(SIGNAL_PIN, INPUT);
  Serial.println(F("Frequency counter on D2"));
}

void loop() {
  // --- Method A: period ---
  unsigned long hi = pulseIn(SIGNAL_PIN, HIGH, 1000000UL);
  unsigned long lo = pulseIn(SIGNAL_PIN, LOW, 1000000UL);

  // --- Method B: 1-second gate ---
  noInterrupts();
  edgeCount = 0;
  interrupts();
  attachInterrupt(digitalPinToInterrupt(SIGNAL_PIN), onRise, RISING);
  delay(1000);
  detachInterrupt(digitalPinToInterrupt(SIGNAL_PIN));
  noInterrupts();
  unsigned long counted = edgeCount;
  interrupts();

  Serial.print(F("A) period: high "));
  Serial.print(hi);
  Serial.print(F(" us, low "));
  Serial.print(lo);
  Serial.print(F(" us"));
  if (hi > 0 && lo > 0) {
    float period = hi + lo;
    Serial.print(F(" -> f = "));
    Serial.print(1e6 / period, 2);
    Serial.print(F(" Hz, duty = "));
    Serial.print(100.0 * hi / period, 1);
    Serial.print(F(" %"));
  } else {
    Serial.print(F(" (no signal)"));
  }
  Serial.print(F("   |   B) gate: "));
  Serial.print(counted);
  Serial.println(F(" Hz"));
}
