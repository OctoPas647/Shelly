// Arduino Bench — Unit 8: Sonar Rangefinder + Theremin
//
// HC-SR04: VCC->5V, GND->GND, TRIG->D7, ECHO->D6
// Passive buzzer: D8 -> buzzer -> GND (add 100 ohm in series to make it quieter)
// Optional: the Unit 7 thermistor divider on A0 for speed-of-sound correction.
//
// distance = (echo time * speed of sound) / 2      (there AND back)
// speed of sound ~= 331.3 + 0.606 * T(C)  m/s
//
// Serial: 'm' toggles mute, 'p' toggles pentatonic (musical) vs smooth pitch.

const byte TRIG_PIN = 7;
const byte ECHO_PIN = 6;
const byte BUZZER_PIN = 8;
const bool USE_THERMISTOR = false;  // set true if the Unit 7 divider is on A0
float airTempC = 20.0;

bool muted = false;
bool pentatonic = true;

// C major pentatonic, two octaves (Hz)
const int SCALE[] = {262, 294, 330, 392, 440, 523, 587, 659, 784, 880};
const byte SCALE_LEN = sizeof(SCALE) / sizeof(SCALE[0]);

float readThermistorC() {
  float adc = analogRead(A0);
  if (adc < 1 || adc > 1022) return airTempC;
  float r = 10000.0 * adc / (1024.0 - adc);
  float tK = 1.0 / (1.0 / 298.15 + log(r / 10000.0) / 3950.0);
  return tK - 273.15;
}

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);   // 10 us pulse starts a "ping" (8 cycles of 40 kHz)
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000UL);  // 30 ms ~ 5 m round trip
  if (us == 0) return -1;         // no echo
  float c = 331.3 + 0.606 * airTempC;          // m/s
  return us * (c / 10000.0) / 2.0;             // us * cm/us / 2
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println(F("Sonar theremin. m = mute, p = pentatonic/smooth"));
}

void loop() {
  if (Serial.available()) {
    char ch = Serial.read();
    if (ch == 'm') muted = !muted;
    if (ch == 'p') pentatonic = !pentatonic;
  }
  if (USE_THERMISTOR) airTempC = readThermistorC();

  float d = readDistanceCm();

  Serial.print(F("distance_cm:"));
  Serial.print(d, 1);
  Serial.print(F(" air_C:"));
  Serial.println(airTempC, 1);

  if (muted || d < 5 || d > 50) {
    noTone(BUZZER_PIN);
  } else if (pentatonic) {
    byte i = constrain((int)((d - 5) / 45.0 * SCALE_LEN), 0, SCALE_LEN - 1);
    tone(BUZZER_PIN, SCALE[SCALE_LEN - 1 - i]);  // closer hand = higher note
  } else {
    tone(BUZZER_PIN, map((long)d, 5, 50, 1500, 200));
  }
  delay(60);  // let echoes die out before the next ping (datasheet: >= 60 ms)
}
