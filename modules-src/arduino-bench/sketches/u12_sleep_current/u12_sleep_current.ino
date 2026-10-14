// Arduino Bench — Unit 12: Where does the current go? (sleep modes)
//
// Power the Uno from a 9 V battery into VIN with the multimeter (mA range)
// IN SERIES with the battery's + lead. USB unplugged!
// Button between D2 and GND. Each press moves to the next mode:
//
//   Mode 0  BUSY      CPU spinning in loop()  (delay() is also busy!)
//   Mode 1  BUSY+LED  on-board LED on - how much does one LED add?
//   Mode 2  IDLE      CPU clock stopped, timers still run (wakes every 1 ms)
//   Mode 3  POWER-DOWN almost everything off; only a LOW on D2 wakes it up
//
// The on-board LED blinks (mode+1) times to tell you which mode you're in.

#include <avr/sleep.h>

const byte BUTTON_PIN = 2;
byte mode = 0;

void wakeUp() {
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));  // LOW level would fire forever
}

bool buttonPressed() {
  if (digitalRead(BUTTON_PIN) == HIGH) return false;
  delay(30);                                   // debounce
  if (digitalRead(BUTTON_PIN) == HIGH) return false;
  while (digitalRead(BUTTON_PIN) == LOW) {}    // wait for release
  delay(30);
  return true;
}

void announce() {
  for (byte i = 0; i <= mode; i++) {
    digitalWrite(LED_BUILTIN, HIGH); delay(150);
    digitalWrite(LED_BUILTIN, LOW);  delay(250);
  }
  if (mode == 1) digitalWrite(LED_BUILTIN, HIGH);
}

void powerDown() {
  digitalWrite(LED_BUILTIN, LOW);
  byte oldAdcsra = ADCSRA;
  ADCSRA = 0;                                 // ADC off (saves ~100s of uA on a bare chip)
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  noInterrupts();
  sleep_enable();
  EIFR = bit(INTF0);                          // clear any stale INT0 flag
  // In power-down only a LOW LEVEL on INT0/INT1 can wake the chip
  // (edge detection needs the I/O clock, which is stopped)
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), wakeUp, LOW);
  interrupts();
  sleep_cpu();                                // ...zzz... execution stops here
  sleep_disable();                            // ...and continues here after wake-up
  ADCSRA = oldAdcsra;
  while (digitalRead(BUTTON_PIN) == LOW) {}   // the waking press: wait for release
  delay(30);
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  announce();
}

void loop() {
  if (buttonPressed()) {
    mode = (mode + 1) % 4;
    digitalWrite(LED_BUILTIN, LOW);
    announce();
  }

  switch (mode) {
    case 0:
    case 1:
      // busy: nothing to do, the CPU just spins round and round
      break;
    case 2:
      set_sleep_mode(SLEEP_MODE_IDLE);
      sleep_mode();                           // sleeps until the next interrupt (~1 ms)
      break;
    case 3:
      powerDown();
      mode = 0;                               // woken up -> back to mode 0
      announce();
      break;
  }
}
