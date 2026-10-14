// Arduino Bench — Unit 10: Sun Tracker (closed-loop proportional control)
//
// Two LDRs side by side on the servo horn, separated by a small cardboard
// "fin" so each one is shaded when the light comes from the other side.
//   5V --[LDR left]--+-- A0      5V --[LDR right]--+-- A1
//                  [10k]                         [10k]
//                    |                              |
//                   GND                            GND
// Servo: signal -> D9, red -> 5V (better: external 5V), brown -> GND.
// Put 100..470 uF across the servo's power pins.
//
// Control law:  error = left - right;   angle += KP * error
// Serial: '+'/'-' change KP,  ']'/'[' change deadband,  'x' flips direction

#include <Servo.h>

Servo servo;
float angle = 90;
float KP = 0.02;
int DEADBAND = 15;
int direction = 1;

void setup() {
  Serial.begin(115200);
  servo.attach(9);
  servo.write((int)angle);
  Serial.println(F("+/- KP, [/] deadband, x = flip direction"));
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == '+') KP *= 1.5;
    if (c == '-') KP /= 1.5;
    if (c == ']') DEADBAND += 5;
    if (c == '[' && DEADBAND >= 5) DEADBAND -= 5;
    if (c == 'x') direction = -direction;
  }

  int left = analogRead(A0);
  int right = analogRead(A1);
  int error = left - right;

  if (abs(error) > DEADBAND) {
    angle += direction * KP * error;
    angle = constrain(angle, 0, 180);
    servo.write((int)angle);
  }

  Serial.print(F("left:"));
  Serial.print(left);
  Serial.print(F(" right:"));
  Serial.print(right);
  Serial.print(F(" error:"));
  Serial.print(error);
  Serial.print(F(" angle_x5:"));
  Serial.print(angle * 5, 0);
  Serial.print(F(" KP_x1000:"));
  Serial.println(KP * 1000, 0);
  delay(20);
}
