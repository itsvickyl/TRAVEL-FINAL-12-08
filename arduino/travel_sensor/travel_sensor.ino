/*
 * LollyD Travel Sensor — Arduino UNO
 * ===================================
 * Reads all sensors and sends JSON over Serial every ~1 second.
 *
 * HARDWARE:
 *   Arduino UNO (ATmega328P)
 *   NEO-6M GPS       → Software Serial (RX=D4, TX=D3)
 *   MPU-6050 IMU     → I2C (SDA=A4, SCL=A5) addr 0x68
 *   BMP280           → I2C (SDA=A4, SCL=A5) addr 0x76
 *   DHT11            → Digital pin D2
 *   MQ-135           → Analog pin A0
 *   HC-SR501 PIR     → Digital pin D5
 *   Ra-02 LoRa       → SPI (CS=D10, MOSI=D11, MISO=D12, SCK=D13)
 *                       + RST=D9, DIO0=D8 (interrupt)
 *
 * LIBRARIES REQUIRED (install via Arduino Library Manager):
 *   - TinyGPSPlus
 *   - DHT sensor library (Adafruit)
 *   - Adafruit BMP280 Library
 *   - Adafruit Unified Sensor
 *   - LoRa (by Sandeep Mistry)
 *
 * ─────────────────────────────────────────────
 * PIN MAP (adjust these if your wiring differs)
 * ─────────────────────────────────────────────
 */

#include <Wire.h>
#include <SoftwareSerial.h>
#include <TinyGPSPlus.h>
#include <DHT.h>
#include <Adafruit_BMP280.h>
#include <SPI.h>
#include <LoRa.h>

// ─── PIN CONFIGURATION ──────────────────────
#define GPS_RX_PIN    4    // GPS TX → Arduino D4
#define GPS_TX_PIN    3    // GPS RX → Arduino D3
#define DHT_PIN       2    // DHT11 data pin
#define DHT_TYPE      DHT11
#define MQ135_PIN     A0   // MQ-135 analog output
#define PIR_PIN       5    // HC-SR501 output
#define LORA_CS_PIN   10   // Ra-02 NSS
#define LORA_RST_PIN  9    // Ra-02 RST
#define LORA_DIO0_PIN 8    // Ra-02 DIO0

// ─── OBJECTS ────────────────────────────────
SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_BMP280 bmp;

// ─── MPU-6050 REGISTERS ─────────────────────
#define MPU_ADDR 0x68

// ─── TIMING ─────────────────────────────────
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 1000; // 1 second

// ─── SENSOR DATA ────────────────────────────
float gpsLat = 0, gpsLng = 0, gpsSpeed = 0, gpsHeading = 0;
int gpsSatellites = 0;
float accelX = 0, accelY = 0, accelZ = 0;
float gyroX = 0, gyroY = 0, gyroZ = 0;
float pitch = 0, roll = 0, yaw = 0;
float bmpPressure = 0, bmpAltitude = 0;
float dhtTemp = 0, dhtHumidity = 0;
int airQualityRaw = 0;
float airQualityPPM = 0;
bool motionDetected = false;
int loraRSSI = 0;
float loraSNR = 0;
float signalStrength = 0;
float supplyVoltage = 0;

bool bmpReady = false;
bool loraReady = false;

void setup() {
  Serial.begin(9600);
  gpsSerial.begin(9600);
  dht.begin();
  Wire.begin();

  // ── Init MPU-6050 ──
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // Wake up
  Wire.endTransmission(true);

  // ── Init BMP280 ──
  if (bmp.begin(0x76)) {
    bmpReady = true;
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                    Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16,
                    Adafruit_BMP280::FILTER_X16,
                    Adafruit_BMP280::STANDBY_MS_500);
  } else {
    Serial.println(F("{\"error\":\"BMP280 not found at 0x76\"}"));
  }

  // ── Init PIR ──
  pinMode(PIR_PIN, INPUT);

  // ── Init LoRa Ra-02 ──
  LoRa.setPins(LORA_CS_PIN, LORA_RST_PIN, LORA_DIO0_PIN);
  if (LoRa.begin(433E6)) {
    loraReady = true;
    LoRa.setSpreadingFactor(7);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(5);
  } else {
    Serial.println(F("{\"error\":\"LoRa Ra-02 init failed\"}"));
  }

  // ── Read supply voltage ──
  // Using internal 1.1V reference to measure Vcc
  // This is an approximation
  supplyVoltage = readVcc() / 1000.0;

  Serial.println(F("{\"status\":\"LollyD Travel Sensor initialized\"}"));
  delay(1000); // Let PIR sensor stabilize
}

void loop() {
  // ── Always feed GPS data ──
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // ── Send telemetry at interval ──
  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();

    readGPS();
    readMPU6050();
    readBMP280();
    readDHT11();
    readMQ135();
    readPIR();
    readLoRa();
    supplyVoltage = readVcc() / 1000.0;

    sendJSON();
  }
}

// ─── GPS (NEO-6M) ───────────────────────────
void readGPS() {
  if (gps.location.isValid()) {
    gpsLat = gps.location.lat();
    gpsLng = gps.location.lng();
  }
  if (gps.speed.isValid()) {
    gpsSpeed = gps.speed.kmph();
  }
  if (gps.course.isValid()) {
    gpsHeading = gps.course.deg();
  }
  gpsSatellites = gps.satellites.value();
}

// ─── IMU (MPU-6050) ─────────────────────────
void readMPU6050() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // Starting register for accel
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)14, (uint8_t)true);

  int16_t rawAx = Wire.read() << 8 | Wire.read();
  int16_t rawAy = Wire.read() << 8 | Wire.read();
  int16_t rawAz = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read(); // skip temp
  int16_t rawGx = Wire.read() << 8 | Wire.read();
  int16_t rawGy = Wire.read() << 8 | Wire.read();
  int16_t rawGz = Wire.read() << 8 | Wire.read();

  // Convert to physical units
  accelX = rawAx / 16384.0; // ±2g range
  accelY = rawAy / 16384.0;
  accelZ = rawAz / 16384.0;
  gyroX = rawGx / 131.0;    // ±250°/s range
  gyroY = rawGy / 131.0;
  gyroZ = rawGz / 131.0;

  // Simple pitch/roll from accelerometer
  pitch = atan2(accelY, sqrt(accelX * accelX + accelZ * accelZ)) * 180.0 / PI;
  roll  = atan2(-accelX, accelZ) * 180.0 / PI;
  // Yaw from gyro integration (approximate, drifts over time)
  yaw += gyroZ * (SEND_INTERVAL / 1000.0);
  if (yaw > 180) yaw -= 360;
  if (yaw < -180) yaw += 360;
}

// ─── PRESSURE & ALTITUDE (BMP280) ───────────
void readBMP280() {
  if (!bmpReady) return;
  bmpPressure = bmp.readPressure() / 100.0F; // Pa → hPa
  bmpAltitude = bmp.readAltitude(1013.25);    // sea level ref
}

// ─── TEMPERATURE & HUMIDITY (DHT11) ─────────
void readDHT11() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) dhtTemp = t;
  if (!isnan(h)) dhtHumidity = h;
}

// ─── AIR QUALITY (MQ-135) ───────────────────
void readMQ135() {
  airQualityRaw = analogRead(MQ135_PIN);
  // Simple PPM approximation (calibrate for accuracy)
  // MQ-135 analog: 0-1023 → ~10-1000 PPM range
  airQualityPPM = (float)map(airQualityRaw, 0, 1023, 10, 1000);
}

// ─── MOTION (HC-SR501 PIR) ──────────────────
void readPIR() {
  motionDetected = digitalRead(PIR_PIN) == HIGH;
}

// ─── LoRa (Ra-02 SX1278) ────────────────────
void readLoRa() {
  if (!loraReady) return;
  // Check for incoming packet (non-blocking)
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    // Read and discard packet data (we just want signal info)
    while (LoRa.available()) {
      LoRa.read();
    }
    loraRSSI = LoRa.packetRssi();
    loraSNR = LoRa.packetSnr();
  }
  // Signal strength: RSSI mapped to 0-100%
  // RSSI range: -120 (worst) to -30 (best)
  long mappedSignal = map(loraRSSI, -120, -30, 0, 100);
  signalStrength = (float)constrain(mappedSignal, 0L, 100L);
}

// ─── SUPPLY VOLTAGE ─────────────────────────
long readVcc() {
#if defined(ARDUINO_ARCH_AVR)
  // Read internal 1.1V reference against AVcc (Arduino Uno/Nano ATmega328P)
  ADMUX = _BV(REFS0) | _BV(MUX3) | _BV(MUX2) | _BV(MUX1);
  delay(2);
  ADCSRA |= _BV(ADSC);
  while (bit_is_set(ADCSRA, ADSC));
  long result = ADCL;
  result |= ADCH << 8;
  result = 1126400L / result; // Back-calculate AVcc in mV
  return result;
#elif defined(ESP8266)
  // ESP8266 internal VCC reading (returns mV)
  return ESP.getVcc();
#elif defined(ARDUINO_ARCH_MEGAAVR)
  // Arduino Nano Every (ATmega4809) runs at 5V
  return 5000;
#else
  // Default fallback for ESP32 and other 3.3V architectures
  return 3300;
#endif
}

// ─── SEND JSON ──────────────────────────────
void sendJSON() {
  // Use compact JSON to minimize serial bandwidth
  Serial.print(F("{\"lat\":"));
  Serial.print(gpsLat, 6);
  Serial.print(F(",\"lng\":"));
  Serial.print(gpsLng, 6);
  Serial.print(F(",\"speed\":"));
  Serial.print(gpsSpeed, 1);
  Serial.print(F(",\"heading\":"));
  Serial.print(gpsHeading, 1);
  Serial.print(F(",\"satellites\":"));
  Serial.print(gpsSatellites);

  Serial.print(F(",\"aX\":"));
  Serial.print(accelX, 3);
  Serial.print(F(",\"aY\":"));
  Serial.print(accelY, 3);
  Serial.print(F(",\"aZ\":"));
  Serial.print(accelZ, 3);
  Serial.print(F(",\"gX\":"));
  Serial.print(gyroX, 1);
  Serial.print(F(",\"gY\":"));
  Serial.print(gyroY, 1);
  Serial.print(F(",\"gZ\":"));
  Serial.print(gyroZ, 1);
  Serial.print(F(",\"pitch\":"));
  Serial.print(pitch, 2);
  Serial.print(F(",\"roll\":"));
  Serial.print(roll, 2);
  Serial.print(F(",\"yaw\":"));
  Serial.print(yaw, 2);

  Serial.print(F(",\"pressure\":"));
  Serial.print(bmpPressure, 1);
  Serial.print(F(",\"altitude\":"));
  Serial.print(bmpAltitude, 1);

  Serial.print(F(",\"temperature\":"));
  Serial.print(dhtTemp, 1);
  Serial.print(F(",\"humidity\":"));
  Serial.print(dhtHumidity, 1);

  Serial.print(F(",\"airQuality\":"));
  Serial.print(airQualityPPM, 0);

  Serial.print(F(",\"motionDetected\":"));
  Serial.print(motionDetected ? F("true") : F("false"));

  Serial.print(F(",\"loraRSSI\":"));
  Serial.print(loraRSSI);
  Serial.print(F(",\"loraSNR\":"));
  Serial.print(loraSNR, 1);
  Serial.print(F(",\"signalStrength\":"));
  Serial.print(signalStrength, 0);

  Serial.print(F(",\"batteryVoltage\":"));
  Serial.print(supplyVoltage, 2);

  Serial.println(F("}"));
}
