// Arduino Bench — Unit 7: Night light with HYSTERESIS
//
// 5V --[LDR]--+-- A0          (more light -> higher reading)
//             |
//          [10k]
//             |
//            GND
// D9 --[220]-- LED -- GND
//
// Two thresholds instead of one: turn ON below ON_BELOW, turn OFF above
// OFF_ABOVE. The gap between them is the hysteresis band.
// Send 'h' to switch hysteresis off/on and count how often the LED toggles
// when you hold your hand so the light level sits right at the edge.

const byte LDR_PIN = A0;
const byte LED_PIN = 9;

int ON_BELOW = 300;
int OFF_ABOVE = 400;
bool hysteresis = true;
bool lightOn = false;

unsigned int toggles = 0;
unsigned long windowStart = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  if (Serial.available() && Serial.read() == 'h') {
    hysteresis = !hysteresis;
    toggles = 0;
    windowStart = millis();
  }

  int level = analogRead(LDR_PIN);
  bool newState = lightOn;
  if (hysteresis) {
    if (level < ON_BELOW) newState = true;
    if (level > OFF_ABOVE) newState = false;
  } else {
    int single = (ON_BELOW + OFF_ABOVE) / 2;
    newState = level < single;
  }

  if (newState != lightOn) {
    lightOn = newState;
    toggles++;
  }
  digitalWrite(LED_PIN, lightOn);

  if (millis() - windowStart > 10000) {
    windowStart = millis();
    toggles = 0;
  }

  Serial.print(F("light:"));
  Serial.print(level);
  Serial.print(F(" on_below:"));
  Serial.print(hysteresis ? ON_BELOW : (ON_BELOW + OFF_ABOVE) / 2);
  Serial.print(F(" off_above:"));
  Serial.print(hysteresis ? OFF_ABOVE : (ON_BELOW + OFF_ABOVE) / 2);
  Serial.print(F(" led_x100:"));
  Serial.print(lightOn ? 100 : 0);
  Serial.print(F(" toggles_10s:"));
  Serial.println(toggles);
  delay(10);
}
