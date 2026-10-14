// Arduino Bench — Unit 11: Optical Serial Link (build your own UART)
//
// TX:  D7 --[220]-- LED -- GND        (point the LED straight at the LDR)
// RX:  5V --[LDR]--+-- A0
//                [10k]
//                  |
//                 GND
// Shield the LED+LDR pair from room light with a paper tube or black tape.
//
// The frame is a real UART frame, sent with light:
//   idle = LIGHT (logic 1)  | start bit = DARK (0) | 8 data bits, LSB first |
//   2 stop bits = LIGHT (1)
// The receiver is independent of the transmitter: it waits for the
// light->dark edge of a start bit, jumps 1.5 bit-times ahead to land in the
// MIDDLE of data bit 0, then samples once per bit-time.
//
// Type a message in Serial Monitor (Newline ending) and press Enter.
// Type  #20  to change the speed to 20 baud. Push it until it breaks!

const byte TX_PIN = 7;
const byte RX_PIN = A0;

unsigned int baud = 10;
unsigned long bitUs = 100000UL;

int thLow, thHigh;       // hysteresis thresholds
bool lineLight = true;   // digitised RX line (true = light = 1)

// ---- TX ----
char txQueue[64];
byte qHead = 0, qTail = 0;
int txBit = -1;          // -1 idle, 0 start, 1..8 data, 9..10 stop
byte txByte;
unsigned long txNextUs;

// ---- RX ----
int rxBit = -1;          // -1 waiting for start, 0..7 data, 8 stop
byte rxByte;
unsigned long rxNextUs;
bool rxArmed = true;     // must see the line light again before a new frame
unsigned int framingErrors = 0;

// ---- typed line ----
char lineBuf[64];
byte lineLen = 0;

bool due(unsigned long t) { return (long)(micros() - t) >= 0; }

int averageLevel() {
  long s = 0;
  for (byte i = 0; i < 32; i++) { s += analogRead(RX_PIN); delay(5); }
  return s / 32;
}

void calibrate() {
  digitalWrite(TX_PIN, LOW);
  delay(600);
  int dark = averageLevel();
  digitalWrite(TX_PIN, HIGH);
  delay(600);
  int light = averageLevel();
  int span = light - dark;
  thLow = dark + span * 35 / 100;
  thHigh = dark + span * 65 / 100;
  Serial.print(F("Calibration: dark="));
  Serial.print(dark);
  Serial.print(F(" light="));
  Serial.print(light);
  Serial.print(F(" thresholds="));
  Serial.print(thLow);
  Serial.print('/');
  Serial.println(thHigh);
  if (span < 80) Serial.println(F("WARNING: weak contrast - move LED closer / shield from room light"));
}

void enqueue(char c) {
  byte next = (qHead + 1) % sizeof(txQueue);
  if (next != qTail) { txQueue[qHead] = c; qHead = next; }
}

void serviceTx() {
  if (txBit == -1) {
    if (qHead == qTail) return;             // nothing to send, stay idle (light)
    txByte = txQueue[qTail];
    qTail = (qTail + 1) % sizeof(txQueue);
    digitalWrite(TX_PIN, LOW);              // start bit: dark
    txBit = 0;
    txNextUs = micros() + bitUs;
    return;
  }
  if (!due(txNextUs)) return;
  txNextUs += bitUs;
  txBit++;
  if (txBit <= 8) {
    digitalWrite(TX_PIN, bitRead(txByte, txBit - 1) ? HIGH : LOW);  // LSB first
  } else if (txBit <= 10) {
    digitalWrite(TX_PIN, HIGH);             // stop bits: light
  } else {
    txBit = -1;                             // frame done
  }
}

void serviceRx() {
  int level = analogRead(RX_PIN);
  if (level > thHigh) lineLight = true;
  if (level < thLow) lineLight = false;

  if (rxBit == -1) {
    if (lineLight) rxArmed = true;
    if (rxArmed && !lineLight) {            // light -> dark: a start bit begins
      rxArmed = false;
      rxBit = 0;
      rxByte = 0;
      rxNextUs = micros() + bitUs + bitUs / 2;
    }
    return;
  }
  if (!due(rxNextUs)) return;
  rxNextUs += bitUs;
  if (rxBit < 8) {
    if (lineLight) bitSet(rxByte, rxBit);
    rxBit++;
  } else {                                  // stop bit must be light
    if (lineLight) {
      Serial.write(rxByte);
    } else {
      framingErrors++;
      Serial.print(F("[framing error #"));
      Serial.print(framingErrors);
      Serial.print(']');
    }
    rxBit = -1;
  }
}

void setBaud(unsigned int b) {
  baud = constrain(b, 1, 200);
  bitUs = 1000000UL / baud;
  Serial.print(F("Speed: "));
  Serial.print(baud);
  Serial.print(F(" baud = "));
  Serial.print(bitUs / 1000.0, 1);
  Serial.println(F(" ms per bit"));
}

void readKeyboard() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      lineBuf[lineLen] = 0;
      if (lineBuf[0] == '#') {
        setBaud(atoi(lineBuf + 1));
      } else {
        Serial.print(F("TX> "));
        Serial.println(lineBuf);
        Serial.print(F("RX< "));
        for (byte i = 0; i < lineLen; i++) enqueue(lineBuf[i]);
        enqueue('\n');
      }
      lineLen = 0;
    } else if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(TX_PIN, OUTPUT);
  calibrate();
  digitalWrite(TX_PIN, HIGH);  // idle = light
  setBaud(baud);
  Serial.println(F("Type a message and press Enter. '#20' = 20 baud."));
}

void loop() {
  readKeyboard();
  serviceTx();
  serviceRx();
}
