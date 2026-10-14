// Arduino Bench — Unit 6: 74HC595 shift register — 8 outputs from 3 pins
//
// 74HC595   Arduino
//   14 DS    -> D11 (data)
//   11 SHCP  -> D12 (shift clock)
//   12 STCP  -> D8  (latch / storage clock)
//   13 /OE   -> D9  (PWM: brightness, active LOW!)
//   10 /MR   -> 5V  (never reset)
//   16 VCC   -> 5V,  8 GND -> GND,  100 nF cap between 16 and 8
//   Q0..Q7 (15, 1..7) -> 1k resistor -> LED -> GND
//
// Serial: 0..9 = brightness, m = next pattern

const byte DATA_PIN = 11;
const byte CLOCK_PIN = 12;
const byte LATCH_PIN = 8;
const byte OE_PIN = 9;

byte pattern = 0;  // 0 binary counter, 1 scanner, 2 sparkle
unsigned long lastFrame = 0;
byte counter = 0;
int scanPos = 0, scanDir = 1;

void writeOutputs(byte value) {
  digitalWrite(LATCH_PIN, LOW);                  // outputs keep their old value...
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, value); // ...while 8 new bits shift in
  digitalWrite(LATCH_PIN, HIGH);                 // rising edge copies them to Q0..Q7
}

void setBrightness(byte level) {          // level 0..9
  analogWrite(OE_PIN, 255 - level * 255 / 9);  // /OE is active LOW -> invert
}

void setup() {
  Serial.begin(115200);
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(OE_PIN, OUTPUT);
  setBrightness(9);
  writeOutputs(0);
  Serial.println(F("0-9 brightness, m = next pattern"));
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c >= '0' && c <= '9') setBrightness(c - '0');
    if (c == 'm') { pattern = (pattern + 1) % 3; Serial.print(F("pattern ")); Serial.println(pattern); }
  }

  if (millis() - lastFrame < 120) return;
  lastFrame = millis();

  switch (pattern) {
    case 0:  // binary counter: watch Q0 toggle every frame, Q7 every 128 frames
      writeOutputs(counter++);
      break;
    case 1:  // scanner
      writeOutputs(1 << scanPos);
      scanPos += scanDir;
      if (scanPos == 7 || scanPos == 0) scanDir = -scanDir;
      break;
    case 2:  // sparkle
      writeOutputs(random(256) & random(256));
      break;
  }
}
