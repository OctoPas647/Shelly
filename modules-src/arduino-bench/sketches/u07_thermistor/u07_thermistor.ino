// Arduino Bench — Unit 7: NTC Thermistor Thermometer (Beta equation)
//
// 5V --[R_FIXED 10k]--+-- A0
//                     |
//                   [NTC 10k]
//                     |
//                    GND
//
// Ratiometric: V(A0)/Vcc = R_ntc / (R_fixed + R_ntc), so the supply voltage
// cancels out:  R_ntc = R_fixed * adc / (1024 - adc)
//
// Beta equation:  1/T = 1/T0 + (1/B) * ln(R/R0)      (T in kelvin)

const float R_FIXED = 10000.0;  // measure it!
const float R0 = 10000.0;       // thermistor resistance at T0
const float T0_K = 298.15;      // 25 C
float BETA = 3950.0;            // typical for kit thermistors - calibrate in the lab!
const float ALPHA = 0.1;        // smoothing factor for the exponential filter

float smoothC = NAN;

void setup() {
  Serial.begin(115200);
  Serial.println(F("Thermistor. Type a Beta value (e.g. 3435) + Enter to change it."));
}

void loop() {
  if (Serial.available()) {
    float b = Serial.parseFloat();
    if (b > 1000 && b < 6000) BETA = b;
  }

  long sum = 0;
  for (byte i = 0; i < 16; i++) sum += analogRead(A0);
  float adc = sum / 16.0;
  if (adc < 1 || adc > 1022) {
    Serial.println(F("Out of range - check wiring"));
    delay(500);
    return;
  }

  float r = R_FIXED * adc / (1024.0 - adc);
  float tK = 1.0 / (1.0 / T0_K + log(r / R0) / BETA);
  float tC = tK - 273.15;

  if (isnan(smoothC)) smoothC = tC;
  smoothC += ALPHA * (tC - smoothC);  // exponential moving average

  Serial.print(F("R_ntc_ohm:"));
  Serial.print(r, 0);
  Serial.print(F(" raw_C:"));
  Serial.print(tC, 2);
  Serial.print(F(" smooth_C:"));
  Serial.print(smoothC, 2);
  Serial.print(F(" beta:"));
  Serial.println(BETA, 0);
  delay(250);
}
