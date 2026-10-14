// Arduino Bench — Unit 1: Divider Detective
// Turns the Arduino into a two-channel voltmeter (A0, A1) and measures
// its OWN 5 V rail using the internal 1.1 V bandgap reference.
//
// Open Serial Monitor at 115200 baud.

const float VREF_NOMINAL = 5.00;  // what most sketches assume the rail is
long BANDGAP_mV = 1100;           // calibrate this! (each chip: ~1000-1200 mV)
const byte SAMPLES = 16;          // averaging reduces noise by ~sqrt(16) = 4x

// Measure the real AVcc by reading the 1.1 V bandgap with AVcc as reference:
//   ADC = Vbg * 1024 / Vcc   ->   Vcc = Vbg * 1024 / ADC
long readVcc_mV() {
  ADMUX = _BV(REFS0) | _BV(MUX3) | _BV(MUX2) | _BV(MUX1);  // ref=AVcc, input=1.1V
  delay(2);                                                // let it settle
  ADCSRA |= _BV(ADSC);                                     // start conversion
  while (bit_is_set(ADCSRA, ADSC)) {}                      // wait until done
  unsigned int result = ADC;
  return (BANDGAP_mV * 1024L) / result;
}

int readAveraged(byte pin) {
  analogRead(pin);  // dummy read: the sample cap needs time after a channel switch
  long sum = 0;
  for (byte i = 0; i < SAMPLES; i++) sum += analogRead(pin);
  return sum / SAMPLES;
}

void setup() {
  Serial.begin(115200);
  Serial.println(F("Divider Detective - A0/A1 voltmeter"));
  Serial.println(F("Type a number (e.g. 1083) + Enter to set the bandgap in mV."));
}

void printChannel(const __FlashStringHelper* name, int counts, float vcc) {
  float vNominal = counts * VREF_NOMINAL / 1024.0;
  float vReal = counts * vcc / 1024.0;
  Serial.print(name);
  Serial.print(F(" counts="));
  Serial.print(counts);
  Serial.print(F("  V(assume 5.00)="));
  Serial.print(vNominal, 3);
  Serial.print(F("  V(real Vcc)="));
  Serial.print(vReal, 3);
  Serial.print(F("   "));
}

void loop() {
  // Calibration: measure the 5V pin with your multimeter, then adjust
  // BANDGAP_mV until "Vcc" below matches it.
  if (Serial.available()) {
    long v = Serial.parseInt();
    if (v > 900 && v < 1300) {
      BANDGAP_mV = v;
      Serial.print(F("Bandgap set to "));
      Serial.print(BANDGAP_mV);
      Serial.println(F(" mV"));
    }
  }

  float vcc = readVcc_mV() / 1000.0;
  int a0 = readAveraged(A0);
  int a1 = readAveraged(A1);

  Serial.print(F("Vcc="));
  Serial.print(vcc, 3);
  Serial.print(F(" V | "));
  printChannel(F("A0"), a0, vcc);
  printChannel(F("A1"), a1, vcc);
  Serial.println();
  delay(500);
}
