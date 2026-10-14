// Arduino Bench — Unit 10: Stepper that follows a knob (28BYJ-48 + ULN2003)
//
// ULN2003 board: IN1->D8, IN2->D9, IN3->D10, IN4->D11, + -> external 5V, - -> GND
// Pot on A0. The shaft points to wherever the knob points (open-loop:
// no sensor! the Arduino just counts the steps it has sent).

#include <Stepper.h>

const int STEPS_PER_REV = 2048;  // 32 steps x ~64:1 gearbox (full-step mode)
// Pin order IN1, IN3, IN2, IN4 gives the correct coil sequence for this motor
Stepper stepper(STEPS_PER_REV, 8, 10, 9, 11);

long position = 0;  // steps we've sent so far

void setup() {
  Serial.begin(115200);
  stepper.setSpeed(12);  // rpm; above ~15 rpm this motor starts skipping steps
}

void loop() {
  long target = map(analogRead(A0), 0, 1023, 0, STEPS_PER_REV);
  long diff = target - position;
  if (abs(diff) > 4) {                // small deadband stops jitter
    int chunk = constrain(diff, -16, 16);
    stepper.step(chunk);
    position += chunk;
  }
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 200) {
    lastPrint = millis();
    Serial.print(F("target:"));
    Serial.print(target);
    Serial.print(F(" position:"));
    Serial.println(position);
  }
}
