// Arduino Bench — Unit 6: 7-segment Electronic Die (via 74HC595)
//
// Same 595 wiring as the counter lab, but Q0..Q7 drive segments a..g + dp
// of a COMMON-CATHODE 7-segment display (common pins -> GND), each segment
// through its own 1k resistor. Button D2 -> GND.
//
// Bit 0 of each byte = segment a, bit 6 = g, bit 7 = decimal point.
//      a
//     ---
//  f |   | b
//     -g-
//  e |   | c
//     ---  . dp
//      d

const byte DATA_PIN = 11;
const byte CLOCK_PIN = 12;
const byte LATCH_PIN = 8;
const byte OE_PIN = 9;
const byte BUTTON_PIN = 2;

const byte DIGITS[10] = {
  0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F
};
const byte DP = 0x80;

void show(byte segments) {
  digitalWrite(LATCH_PIN, LOW);
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, segments);
  digitalWrite(LATCH_PIN, HIGH);
}

void roll() {
  // Spin fast, then slow down like a real die
  int delayMs = 30;
  byte face = 1;
  while (delayMs < 300) {
    face = random(1, 7);
    show(DIGITS[face] | DP);
    delay(delayMs);
    delayMs = delayMs * 23 / 20;  // +15 % each step
  }
  show(DIGITS[face]);
  Serial.print(F("Rolled: "));
  Serial.println(face);
}

void setup() {
  Serial.begin(115200);
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(OE_PIN, OUTPUT);
  digitalWrite(OE_PIN, LOW);  // outputs on
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  show(0x40);                 // just segment g: "-"
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    // The exact microsecond you press is unpredictable -> good randomness
    randomSeed(micros() ^ analogRead(A5));
    roll();
    while (digitalRead(BUTTON_PIN) == LOW) {}  // wait for release
    delay(30);                                   // ignore release bounce
  }
}
