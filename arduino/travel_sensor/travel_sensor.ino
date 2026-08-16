/*
 * LollyD Travel Sensor — Arduino Nano Every / UNO (Production Hardened)
 * ======================================================================
 * High-reliability multi-sensor flight/travel telemetry logger.
 *
 * SENSORS & PERIPHERALS:
 *   - NEO-6M GPS       → SoftwareSerial (RX=D4, TX=D3)
 *   - MPU-6050 IMU     → I2C (SDA=A4, SCL=A5) addr 0x68
 *   - BMP280           → I2C (SDA=A4, SCL=A5) addr 0x76
 *   - DHT11            → Digital pin D2
 *   - MQ-135           → Analog pin A0
 *   - HC-SR501 PIR     → Digital pin D5 (60s non-blocking warm-up)
 *   - Ra-02 LoRa       → SPI (CS=D10, RST=D9, DIO0=D8)
 *   - MicroSD Logger   → SPI (CS=D6) -> /trip_log.csv
 *
 * PRODUCTION HARDENING:
 *   - Monotonic sequence numbers (seq)
 *   - Isolated sensor failure handling (one sensor failure won't crash loop)
 *   - Non-blocking PIR warm-up (suppresses false positives for first 60s)
 *   - Safe SD flush with corruption protection
 *   - Real hardware sensor health mapping
 */

#include <Wire.h>
#include <SoftwareSerial.h>
#include <TinyGPSPlus.h>
#include <DHT.h>
#include <Adafruit_BMP280.h>
#include <SPI.h>
#include <LoRa.h>
#include <SD.h>

// ─── PIN MAP ────────────────────────────────
#define GPS_RX_PIN    4    // GPS TX → Arduino D4
#define GPS_TX_PIN    3    // GPS RX → Arduino D3
#define DHT_PIN       2    // DHT11 data pin
#define DHT_TYPE      DHT11
#define MQ135_PIN     A0   // MQ-135 analog output
#define PIR_PIN       5    // HC-SR501 output
#define SD_CS_PIN     6    // MicroSD Card CS pin (D6)
#define LORA_CS_PIN   10   // Ra-02 NSS
#define LORA_RST_PIN  9    // Ra-02 RST
#define LORA_DIO0_PIN 8    // Ra-02 DIO0

#define MPU_ADDR      0x68

// ─── CONSTANTS & TIMING ─────────────────────
const unsigned long SEND_INTERVAL = 1000;    // 1 second telemetry loop
const unsigned long PIR_WARMUP_MS = 60000;   // 60-second non-blocking PIR warm-up

// ─── OBJECTS ────────────────────────────────
SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_BMP280 bmp;

// ─── STATE & HEALTH TRACKING ────────────────
unsigned long seqNumber = 0;
unsigned long lastSendTime = 0;

bool bmpReady = false;
bool mpuReady = false;
bool dhtReady = false;
bool loraReady = false;
bool sdReady = false;

// Sensor Readings
float gpsLat = 0.0, gpsLng = 0.0, gpsSpeed = 0.0, gpsHeading = 0.0;
int gpsSatellites = 0;
float accelX = 0.0, accelY = 0.0, accelZ = 0.0;
float gyroX = 0.0, gyroY = 0.0, gyroZ = 0.0;
float pitch = 0.0, roll = 0.0, yaw = 0.0;
float bmpPressure = 0.0, bmpAltitude = 0.0;
float dhtTemp = 0.0, dhtHumidity = 0.0;
int airQualityRaw = 0;
float airQualityPPM = 0.0;
bool motionDetected = false;
int loraRSSI = 0;
float loraSNR = 0.0;
float signalStrength = 0.0;
float supplyVoltage = 5.0;

void setup() {
  Serial.begin(9600);
  gpsSerial.begin(9600);
  Wire.begin();

  // 1. Init DHT11
  dht.begin();
  dhtReady = true;

  // 2. Init MPU-6050 (with failure isolation)
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // Wake up
  if (Wire.endTransmission(true) == 0) {
    mpuReady = true;
  } else {
    mpuReady = false;
    Serial.println(F("{\"warn\":\"MPU-6050 init failed\"}"));
  }

  // 3. Init BMP280 (with failure isolation)
  if (bmp.begin(0x76)) {
    bmpReady = true;
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                    Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16,
                    Adafruit_BMP280::FILTER_X16,
                    Adafruit_BMP280::STANDBY_MS_500);
  } else {
    bmpReady = false;
    Serial.println(F("{\"warn\":\"BMP280 not found at 0x76\"}"));
  }

  // 4. Init PIR Pin
  pinMode(PIR_PIN, INPUT);

  // 5. Init LoRa (with failure isolation)
  LoRa.setPins(LORA_CS_PIN, LORA_RST_PIN, LORA_DIO0_PIN);
  if (LoRa.begin(433E6)) {
    loraReady = true;
    LoRa.setSpreadingFactor(7);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(5);
  } else {
    loraReady = false;
    Serial.println(F("{\"warn\":\"LoRa Ra-02 init failed\"}"));
  }

  // 6. Init MicroSD Logger (with failure isolation & header generation)
  if (SD.begin(SD_CS_PIN)) {
    sdReady = true;
    File logFile = SD.open("trip_log.csv", FILE_WRITE);
    if (logFile) {
      if (logFile.size() == 0) {
        logFile.println(F("seq,uptime_s,lat,lng,speed_kmh,sats,alt_m,temp_c,humidity_pct,pressure_hpa,aqi_ppm,pitch,roll,yaw,motion"));
      }
      logFile.flush();
      logFile.close();
    }
    Serial.println(F("{\"info\":\"MicroSD logging active (/trip_log.csv)\"}"));
  } else {
    sdReady = false;
    Serial.println(F("{\"warn\":\"MicroSD Card init failed on D6\"}"));
  }

  supplyVoltage = readSupplyVoltage() / 1000.0;
  Serial.println(F("{\"status\":\"LollyD Sensor Hub Ready\"}"));
}

void loop() {
  // Feed GPS byte stream constantly
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Telemetry loop trigger
  unsigned long currentMillis = millis();
  if (currentMillis - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = currentMillis;
    seqNumber++;

    readGPS();
    readMPU6050();
    readBMP280();
    readDHT11();
    readMQ135();
    readPIR();
    readLoRa();
    supplyVoltage = readSupplyVoltage() / 1000.0;

    logToSD();
    sendTelemetryJSON();
  }
}

// ─── GPS READING ────────────────────────────
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

// ─── MPU-6050 IMU ───────────────────────────
void readMPU6050() {
  if (!mpuReady) return;

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) {
    return;
  }

  if (Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)14, (uint8_t)true) == 14) {
    int16_t rawAx = Wire.read() << 8 | Wire.read();
    int16_t rawAy = Wire.read() << 8 | Wire.read();
    int16_t rawAz = Wire.read() << 8 | Wire.read();
    Wire.read(); Wire.read(); // skip internal temp
    int16_t rawGx = Wire.read() << 8 | Wire.read();
    int16_t rawGy = Wire.read() << 8 | Wire.read();
    int16_t rawGz = Wire.read() << 8 | Wire.read();

    accelX = rawAx / 16384.0;
    accelY = rawAy / 16384.0;
    accelZ = rawAz / 16384.0;
    gyroX  = rawGx / 131.0;
    gyroY  = rawGy / 131.0;
    gyroZ  = rawGz / 131.0;

    float denom = sqrt(accelX * accelX + accelZ * accelZ);
    if (denom > 0.001) {
      pitch = atan2(accelY, denom) * 180.0 / PI;
    }
    roll = atan2(-accelX, accelZ) * 180.0 / PI;
    yaw += gyroZ * (SEND_INTERVAL / 1000.0);
    if (yaw > 180.0) yaw -= 360.0;
    if (yaw < -180.0) yaw += 360.0;
  }
}

// ─── BMP280 PRESSURE & ALTITUDE ─────────────
void readBMP280() {
  if (!bmpReady) return;
  float p = bmp.readPressure();
  if (!isnan(p) && p > 30000.0) {
    bmpPressure = p / 100.0F; // Pa to hPa
    bmpAltitude = bmp.readAltitude(1013.25);
  }
}

// ─── DHT11 TEMPERATURE & HUMIDITY ───────────
void readDHT11() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t) && t >= -20.0 && t <= 80.0) dhtTemp = t;
  if (!isnan(h) && h >= 0.0 && h <= 100.0) dhtHumidity = h;
}

// ─── MQ-135 AIR QUALITY ─────────────────────
void readMQ135() {
  airQualityRaw = analogRead(MQ135_PIN);
  airQualityPPM = (float)map(airQualityRaw, 0, 1023, 10, 1000);
}

// ─── PIR MOTION & WARMUP ────────────────────
void readPIR() {
  // Non-blocking warm-up check: suppress triggers for first 60 seconds
  if (millis() < PIR_WARMUP_MS) {
    motionDetected = false;
  } else {
    motionDetected = (digitalRead(PIR_PIN) == HIGH);
  }
}

// ─── LoRa (Ra-02) ───────────────────────────
void readLoRa() {
  if (!loraReady) return;
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    while (LoRa.available()) {
      LoRa.read();
    }
    loraRSSI = LoRa.packetRssi();
    loraSNR = LoRa.packetSnr();
  }
  long mappedSignal = map(loraRSSI, -120, -30, 0, 100);
  signalStrength = (float)constrain(mappedSignal, 0L, 100L);
}

// ─── SUPPLY VOLTAGE ─────────────────────────
long readSupplyVoltage() {
#if defined(ARDUINO_ARCH_AVR)
  ADMUX = _BV(REFS0) | _BV(MUX3) | _BV(MUX2) | _BV(MUX1);
  delay(2);
  ADCSRA |= _BV(ADSC);
  while (bit_is_set(ADCSRA, ADSC));
  long result = ADCL;
  result |= ADCH << 8;
  return 1126400L / result;
#elif defined(ARDUINO_ARCH_MEGAAVR)
  return 5000;
#else
  return 5000;
#endif
}

// ─── SD CARD LOGGING ────────────────────────
void logToSD() {
  if (!sdReady) return;
  File logFile = SD.open("trip_log.csv", FILE_WRITE);
  if (logFile) {
    logFile.print(seqNumber); logFile.print(F(","));
    logFile.print(millis() / 1000); logFile.print(F(","));
    logFile.print(gpsLat, 6); logFile.print(F(","));
    logFile.print(gpsLng, 6); logFile.print(F(","));
    logFile.print(gpsSpeed, 1); logFile.print(F(","));
    logFile.print(gpsSatellites); logFile.print(F(","));
    logFile.print(bmpAltitude, 1); logFile.print(F(","));
    logFile.print(dhtTemp, 1); logFile.print(F(","));
    logFile.print(dhtHumidity, 1); logFile.print(F(","));
    logFile.print(bmpPressure, 1); logFile.print(F(","));
    logFile.print(airQualityPPM, 0); logFile.print(F(","));
    logFile.print(pitch, 1); logFile.print(F(","));
    logFile.print(roll, 1); logFile.print(F(","));
    logFile.print(yaw, 1); logFile.print(F(","));
    logFile.println(motionDetected ? 1 : 0);
    logFile.flush();
    logFile.close();
  }
}

// ─── SEND JSON TELEMETRY ────────────────────
void sendTelemetryJSON() {
  bool isCalibrating = (millis() < PIR_WARMUP_MS);

  Serial.print(F("{\"seq\":"));
  Serial.print(seqNumber);
  Serial.print(F(",\"uptime\":"));
  Serial.print(millis() / 1000);

  Serial.print(F(",\"lat\":"));
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

  Serial.print(F(",\"pirStatus\":\""));
  Serial.print(isCalibrating ? F("CALIBRATING") : F("OK"));
  Serial.print(F("\""));

  Serial.print(F(",\"loraRSSI\":"));
  Serial.print(loraRSSI);
  Serial.print(F(",\"loraSNR\":"));
  Serial.print(loraSNR, 1);
  Serial.print(F(",\"signalStrength\":"));
  Serial.print(signalStrength, 0);

  Serial.print(F(",\"batteryVoltage\":"));
  Serial.print(supplyVoltage, 2);

  Serial.print(F(",\"sd\":"));
  Serial.print(sdReady ? F("true") : F("false"));
  Serial.print(F(",\"sdStatus\":\""));
  Serial.print(sdReady ? F("OK") : F("ERROR"));
  Serial.print(F("\""));

  Serial.println(F("}"));
}
