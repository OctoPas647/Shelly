// Arduino Bench — Unit 3: PWM + RC filter = a homemade DAC
//
// D9 (PWM, ~490 Hz) --[R]--+-- A0
//                          |
//                         [C]  (electrolytic: + to this node)
//                          |
//                         GND
//
// Start with R = 10k, C = 10 uF  (tau = 100 ms, smooth but slow).
// Then try   R = 1k,  C = 10 uF  (tau = 10 ms, fast but rippley).
//
// Open the Serial PLOTTER (115200). The sketch steps the duty cycle every 3 s
// so you can watch the exponential RC charge/discharge curve.
//
// Serial commands:
//   0..9  -> fixed duty (0 = 0 %, 9 = 100 %) and stop auto-stepping
//   a     -> back to auto-stepping
//   r     -> ripple burst: 200 samples as fast as possible (shows the ripple shape)

const byte PWM_PIN = 9;
const byte SENSE_PIN = A0;
const float VCC = 5.00;

const byte steps[] = {0, 64, 128, 191, 255, 128};
byte stepIndex = 0;
byte duty = 0;
bool autoStep = true;
unsigned long lastStep = 0;

void rippleBurst() {
  int buf[200];
  unsigned long t0 = micros();
  for (int i = 0; i < 200; i++) buf[i] = analogRead(SENSE_PIN);
  unsigned long dt = micros() - t0;
  int lo = 1023, hi = 0;
  for (int i = 0; i < 200; i++) {
    lo = min(lo, buf[i]);
    hi = max(hi, buf[i]);
    Serial.print(F("ripple_V:"));
    Serial.println(buf[i] * VCC / 1024.0, 3);
  }
  Serial.print(F("# 200 samples in "));
  Serial.print(dt);
  Serial.print(F(" us. Ripple p-p = "));
  Serial.print((hi - lo) * VCC / 1024.0, 3);
  Serial.println(F(" V"));
}

void setup() {
  Serial.begin(115200);
  analogWrite(PWM_PIN, duty);
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c >= '0' && c <= '9') {
      autoStep = false;
      duty = (c - '0') * 255 / 9;
      analogWrite(PWM_PIN, duty);
    } else if (c == 'a') {
      autoStep = true;
    } else if (c == 'r') {
      rippleBurst();
    }
  }

  if (autoStep && millis() - lastStep > 3000) {
    lastStep = millis();
    stepIndex = (stepIndex + 1) % sizeof(steps);
    duty = steps[stepIndex];
    analogWrite(PWM_PIN, duty);
  }

  float target = duty / 255.0 * VCC;
  float measured = analogRead(SENSE_PIN) * VCC / 1024.0;
  Serial.print(F("target_V:"));
  Serial.print(target, 3);
  Serial.print(F(" filtered_V:"));
  Serial.println(measured, 3);
  delay(5);
}
