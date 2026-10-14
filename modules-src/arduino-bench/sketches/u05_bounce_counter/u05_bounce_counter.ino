// Arduino Bench — Unit 5: See contact bounce (and a floating pin)
//
// Button between D2 and GND (internal pull-up enabled).
// An interrupt counts EVERY edge on D2, so you can see how many times one
// "click" really toggles the pin.
//
// Send 'f' to toggle the floating-pin monitor on D7 (leave a loose jumper
// wire plugged into D7 and nothing else - then touch it / wave your hand).

const byte BUTTON_PIN = 2;
const byte FLOAT_PIN = 7;

volatile unsigned int edges = 0;
volatile unsigned long firstEdgeUs = 0;
volatile unsigned long lastEdgeUs = 0;

bool floatMonitor = false;

void onEdge() {
  unsigned long now = micros();
  if (edges == 0) firstEdgeUs = now;
  lastEdgeUs = now;
  edges++;
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(FLOAT_PIN, INPUT);  // deliberately NO pull-up: it floats
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), onEdge, CHANGE);
  Serial.println(F("Press and release the button. 'f' = floating-pin monitor."));
}

void loop() {
  if (Serial.available() && Serial.read() == 'f') {
    floatMonitor = !floatMonitor;
  }

  if (floatMonitor) {
    Serial.print(F("D7_floating:"));
    Serial.println(digitalRead(FLOAT_PIN));
    delay(20);
    return;
  }

  // Report once the line has been quiet for 50 ms
  noInterrupts();
  unsigned int n = edges;
  unsigned long first = firstEdgeUs, last = lastEdgeUs;
  interrupts();

  if (n > 0 && micros() - last > 50000UL) {
    Serial.print(F("Edges: "));
    Serial.print(n);
    Serial.print(F("  (ideal press+release = 2)  burst length: "));
    Serial.print(last - first);
    Serial.println(F(" us"));
    noInterrupts();
    edges = 0;
    interrupts();
  }
}
