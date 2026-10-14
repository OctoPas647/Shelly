// Arduino Bench — Unit 11: LCD1602 dashboard with custom-character bar graph
//
// LCD (HD44780, 4-bit mode)
//   1 VSS -> GND        2 VDD -> 5V        3 V0 -> 10k contrast pot wiper
//   4 RS  -> D12        5 RW  -> GND       6 E  -> D11
//   11 D4 -> D5   12 D5 -> D4   13 D6 -> D3   14 D7 -> D2
//   15 A (backlight +) -> 220 ohm -> 5V    16 K -> GND
// A second pot (or any 0-5 V signal) on A0 is what gets displayed.

#include <LiquidCrystal.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);  // RS, E, D4, D5, D6, D7

// Each LCD character is a 5x8 pixel grid. These define 1..5 filled columns.
byte bar1[8] = {0x10,0x10,0x10,0x10,0x10,0x10,0x10,0x10};
byte bar2[8] = {0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18};
byte bar3[8] = {0x1C,0x1C,0x1C,0x1C,0x1C,0x1C,0x1C,0x1C};
byte bar4[8] = {0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E};
byte bar5[8] = {0x1F,0x1F,0x1F,0x1F,0x1F,0x1F,0x1F,0x1F};

void setup() {
  lcd.begin(16, 2);
  lcd.createChar(1, bar1);  // custom chars live in the LCD's CGRAM (8 slots)
  lcd.createChar(2, bar2);
  lcd.createChar(3, bar3);
  lcd.createChar(4, bar4);
  lcd.createChar(5, bar5);
  lcd.clear();
}

void loop() {
  int raw = analogRead(A0);
  float v = raw * 5.0 / 1024.0;

  lcd.setCursor(0, 0);
  lcd.print(F("A0 "));
  lcd.print(v, 2);
  lcd.print(F("V  "));
  lcd.setCursor(10, 0);
  unsigned long s = millis() / 1000;
  lcd.print(s / 60);
  lcd.print(':');
  if (s % 60 < 10) lcd.print('0');
  lcd.print(s % 60);
  lcd.print(F("  "));

  // 16 cells x 5 columns = 80 levels of resolution
  int columns = map(raw, 0, 1023, 0, 80);
  lcd.setCursor(0, 1);
  for (byte cell = 0; cell < 16; cell++) {
    int fill = columns - cell * 5;
    if (fill >= 5) lcd.write(byte(5));
    else if (fill > 0) lcd.write(byte(fill));
    else lcd.write(' ');
  }
  delay(100);
}
