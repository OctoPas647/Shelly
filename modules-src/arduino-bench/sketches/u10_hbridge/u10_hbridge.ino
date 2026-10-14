// Arduino Bench — Unit 10: H-bridge motor control (L293D)
//
// L293D   Arduino / power
//   1 EN1,2 -> D5 (PWM)         16 VCC1 (logic) -> 5V
//   2 1A    -> D4               8  VCC2 (motor) -> separate motor supply (+)
//   7 2A    -> D3               4,5,12,13 GND   -> common GND
//   3 1Y    -> motor lead A
//   6 2Y    -> motor lead B
// Pot on A0: centre = stop, right = forward, left = reverse.
// Serial: 'b' toggles stop mode between BRAKE (short the motor) and COAST (float).

const byte EN_PIN = 5;
const byte IN1_PIN = 4;
const byte IN2_PIN = 3;
const int DEADBAND = 40;  // counts around the centre that mean "stop"

bool brakeMode = true;

void drive(int speed) {  // -255..255
  if (speed > 0) {
    digitalWrite(IN1_PIN, HIGH);
    digitalWrite(IN2_PIN, LOW);
    analogWrite(EN_PIN, speed);
  } else if (speed < 0) {
    digitalWrite(IN1_PIN, LOW);
    digitalWrite(IN2_PIN, HIGH);
    analogWrite(EN_PIN, -speed);
  } else if (brakeMode) {
    digitalWrite(IN1_PIN, LOW);   // both outputs LOW -> motor terminals shorted
    digitalWrite(IN2_PIN, LOW);   // -> back-EMF current brakes it hard
    digitalWrite(EN_PIN, HIGH);
  } else {
    digitalWrite(EN_PIN, LOW);    // outputs high-impedance -> motor coasts
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(EN_PIN, OUTPUT);
  pinMode(IN1_PIN, OUTPUT);
  pinMode(IN2_PIN, OUTPUT);
  Serial.println(F("H-bridge. Turn the pot. 'b' = brake/coast"));
}

void loop() {
  if (Serial.available() && Serial.read() == 'b') {
    brakeMode = !brakeMode;
    Serial.println(brakeMode ? F("stop = BRAKE") : F("stop = COAST"));
  }

  int offset = analogRead(A0) - 512;
  int speed = 0;
  if (offset > DEADBAND) speed = map(offset, DEADBAND, 511, 60, 255);
  else if (offset < -DEADBAND) speed = -map(-offset, DEADBAND, 512, 60, 255);
  drive(speed);

  Serial.print(F("speed:"));
  Serial.println(speed);
  delay(50);
}
