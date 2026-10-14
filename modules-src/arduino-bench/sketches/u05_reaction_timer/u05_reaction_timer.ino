// Arduino Bench — Unit 5: Interrupt-timed Reaction Tester
//
// LED (with 220 ohm) on D8, button D2 -> GND, passive buzzer on D10 (optional).
// Wait for the LED, then hit the button. The press time is captured INSIDE
// the interrupt with micros(), so the measurement doesn't depend on how
// busy loop() is.

const byte BUTTON_PIN = 2;
const byte LED_PIN = 8;
const byte BUZZER_PIN = 10;

enum State { READY, WAITING, GO, SHOW };
State state = READY;

volatile bool pressed = false;
volatile unsigned long pressUs = 0;
volatile unsigned long lastIsrUs = 0;

unsigned long goUs = 0;
unsigned long waitUntilMs = 0;
unsigned long bestUs = 0xFFFFFFFFUL;
unsigned long stateStartMs = 0;

void onPress() {
  unsigned long now = micros();
  if (now - lastIsrUs < 150000UL) return;  // software debounce: ignore bounces
  lastIsrUs = now;
  pressUs = now;
  pressed = true;
}

// A press only counts if the button is STILL held 10 ms after the edge.
// Releasing the button also bounces and makes falling edges - those read
// HIGH again 10 ms later, so they get rejected here.
bool takePress() {
  noInterrupts();
  bool p = pressed;
  unsigned long t = pressUs;
  interrupts();
  if (!p) return false;
  if (micros() - t < 10000UL) return false;  // too soon to judge, ask again later
  noInterrupts();
  pressed = false;
  interrupts();
  return digitalRead(BUTTON_PIN) == LOW;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), onPress, FALLING);
  randomSeed(analogRead(A5) ^ micros());  // floating pin noise as a seed
  Serial.println(F("Reaction tester. Press the button to start a round."));
}

void loop() {
  switch (state) {
    case READY:
      if (takePress()) {
        Serial.println(F("Get ready... wait for the light!"));
        waitUntilMs = millis() + random(2000, 5000);
        state = WAITING;
      }
      break;

    case WAITING:
      if (takePress()) {
        Serial.println(F("Too early! Press to try again."));
        tone(BUZZER_PIN, 150, 400);
        state = READY;
      } else if ((long)(millis() - waitUntilMs) >= 0) {
        digitalWrite(LED_PIN, HIGH);
        goUs = micros();
        state = GO;
      }
      break;

    case GO:
      if (takePress()) {
        digitalWrite(LED_PIN, LOW);
        unsigned long r = pressUs - goUs;
        Serial.print(F("Reaction: "));
        Serial.print(r / 1000.0, 1);
        Serial.print(F(" ms"));
        if (r < bestUs) {
          bestUs = r;
          Serial.print(F("  NEW BEST!"));
          tone(BUZZER_PIN, 1760, 150);
        }
        Serial.print(F("   best: "));
        Serial.print(bestUs / 1000.0, 1);
        Serial.println(F(" ms. Press for another round."));
        stateStartMs = millis();
        state = SHOW;
      }
      break;

    case SHOW:
      if (millis() - stateStartMs > 300) {
        takePress();  // drop any press that happened while showing
        state = READY;
      }
      break;
  }
}
