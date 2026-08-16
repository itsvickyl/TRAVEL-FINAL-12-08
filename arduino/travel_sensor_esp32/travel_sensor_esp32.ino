/*
 * LollyD Travel Sensor — Standalone ESP32 (Production Hardened)
 * =============================================================
 * Autonomous Plug & Play IoT Telemetry Transmitter.
 *
 * HARDWARE:
 *   - ESP32 Dev Board
 *   - NEO-6M GPS       → HardwareSerial2 (RX2=GPIO16, TX2=GPIO17)
 *   - MPU-6050 IMU     → I2C (SDA=GPIO21, SCL=GPIO22) addr 0x68
 *   - BMP280           → I2C (SDA=GPIO21, SCL=GPIO22) addr 0x76
 *   - DHT11            → GPIO4
 *   - MQ-135           → GPIO36 (VP / Analog A0)
 *   - HC-SR501 PIR     → GPIO5 (60s non-blocking warm-up)
 *
 * PRODUCTION HARDENING:
 *   - Autonomous operation: continuous local sensor acquisition regardless of cloud connectivity
 *   - Non-blocking Wi-Fi auto-reconnect state machine
 *   - Non-blocking WebSocket auto-reconnect
 *   - Monotonic sequence numbers (seq)
 *   - False-positive suppression during PIR warm-up (60s)
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Wire.h>
#include <TinyGPSPlus.h>
#include <DHT.h>
#include <Adafruit_BMP280.h>
#include <ArduinoJson.h>

// ─── CONFIGURATION ──────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";      // Change to your Wi-Fi / Mobile Hotspot Name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // Change to your Wi-Fi / Mobile Hotspot Password

// Cloud Relay WebSocket Server
const char* WS_HOST = "lollyd-relay.onrender.com"; // Render.com host (without wss://)
const int   WS_PORT = 443;                          // SSL port for wss://
const char* WS_PATH = "/";
const char* RELAY_KEY = "lollyd-travel-2024";

// ─── PIN MAP (ESP32) ────────────────────────
#define GPS_RX_PIN    16   // ESP32 RX2 ← GPS TX
#define GPS_TX_PIN    17   // ESP32 TX2 → GPS RX
#define DHT_PIN       4    // DHT11 Data
#define DHT_TYPE      DHT11
#define MQ135_PIN     36   // VP / Analog pin
#define PIR_PIN       5    // HC-SR501 Motion
#define MPU_ADDR      0x68

// ─── TIMING & CONSTANTS ─────────────────────
const unsigned long SEND_INTERVAL = 1000;    // 1-second telemetry loop
const unsigned long PIR_WARMUP_MS = 60000;   // 60-second non-blocking PIR warm-up
const unsigned long WIFI_CHECK_INTERVAL = 10000; // Check Wi-Fi state every 10s

// ─── OBJECTS ────────────────────────────────
HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_BMP280 bmp;
WebSocketsClient webSocket;

// ─── STATE & SENSOR DATA ────────────────────
unsigned long seqNumber = 0;
unsigned long lastSendTime = 0;
unsigned long lastWifiCheck = 0;

bool bmpReady = false;
bool mpuReady = false;
bool wsConnected = false;

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

// ─── WEBSOCKET EVENT HANDLER ────────────────
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println(F("[WS] Disconnected from Cloud Relay"));
      wsConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.println(F("[WS] Connected to Cloud Relay!"));
      wsConnected = true;
      // Authenticate as publisher
      webSocket.sendTXT("{\"role\":\"publisher\",\"key\":\"" + String(RELAY_KEY) + "\"}");
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Received: %s\n", payload);
      break;
    case WStype_ERROR:
      Serial.println(F("[WS] Socket Error encountered"));
      wsConnected = false;
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println(F("\n=============================================="));
  Serial.println(F(" LollyD Standalone ESP32 — Production Hub"));
  Serial.println(F("=============================================="));

  // 1. Init GPS Serial
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // 2. Init DHT11
  dht.begin();

  // 3. Init I2C bus & MPU-6050
  Wire.begin(21, 22); // SDA=21, SCL=22
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  if (Wire.endTransmission(true) == 0) {
    mpuReady = true;
  } else {
    Serial.println(F("⚠️ MPU-6050 not responding at 0x68"));
  }

  // 4. Init BMP280
  if (bmp.begin(0x76)) {
    bmpReady = true;
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                    Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16,
                    Adafruit_BMP280::FILTER_X16,
                    Adafruit_BMP280::STANDBY_MS_500);
  } else {
    Serial.println(F("⚠️ BMP280 not found at 0x76"));
  }

  // 5. Init PIR Pin
  pinMode(PIR_PIN, INPUT);

  // 6. Connect to Wi-Fi (Non-blocking initial setup)
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Connecting to SSID: %s\n", WIFI_SSID);

  // 7. Init WebSocket Client (wss:// SSL)
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  // 1. Maintain WebSocket State
  webSocket.loop();

  // 2. Feed GPS stream non-stop
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // 3. Non-blocking Wi-Fi Reconnection check
  unsigned long now = millis();
  if (now - lastWifiCheck >= WIFI_CHECK_INTERVAL) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println(F("[WIFI] Disconnected. Attempting auto-reconnect..."));
      WiFi.reconnect();
    }
  }

  // 4. Autonomous Telemetry Acquisition & Transmission
  if (now - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = now;
    seqNumber++;

    readSensors();

    if (wsConnected) {
      sendTelemetryJSON();
    } else {
      Serial.printf("[LOCAL ACQUISITION] Seq #%lu | Temp: %.1fC | Sats: %d | (Waiting for Cloud Connection)\n",
                    seqNumber, dhtTemp, gpsSatellites);
    }
  }
}

void readSensors() {
  // GPS
  if (gps.location.isValid()) {
    gpsLat = gps.location.lat();
    gpsLng = gps.location.lng();
  }
  if (gps.speed.isValid()) gpsSpeed = gps.speed.kmph();
  if (gps.course.isValid()) gpsHeading = gps.course.deg();
  gpsSatellites = gps.satellites.value();

  // MPU-6050
  if (mpuReady) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);
    if (Wire.endTransmission(false) == 0 && Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)14, (uint8_t)true) == 14) {
      int16_t rawAx = Wire.read() << 8 | Wire.read();
      int16_t rawAy = Wire.read() << 8 | Wire.read();
      int16_t rawAz = Wire.read() << 8 | Wire.read();
      Wire.read(); Wire.read(); // skip temp
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
      roll  = atan2(-accelX, accelZ) * 180.0 / PI;
      yaw += gyroZ * (SEND_INTERVAL / 1000.0);
    }
  }

  // BMP280
  if (bmpReady) {
    float p = bmp.readPressure();
    if (!isnan(p) && p > 30000.0) {
      bmpPressure = p / 100.0F;
      bmpAltitude = bmp.readAltitude(1013.25);
    }
  }

  // DHT11
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t) && t >= -20.0 && t <= 80.0) dhtTemp = t;
  if (!isnan(h) && h >= 0.0 && h <= 100.0) dhtHumidity = h;

  // MQ-135
  airQualityRaw = analogRead(MQ135_PIN);
  airQualityPPM = (float)map(airQualityRaw, 0, 4095, 10, 1000);

  // PIR with Non-blocking Warm-Up
  if (millis() < PIR_WARMUP_MS) {
    motionDetected = false;
  } else {
    motionDetected = (digitalRead(PIR_PIN) == HIGH);
  }
}

void sendTelemetryJSON() {
  StaticJsonDocument<512> doc;
  bool isCalibrating = (millis() < PIR_WARMUP_MS);

  doc["seq"] = seqNumber;
  doc["uptime"] = millis() / 1000;

  doc["lat"] = gpsLat;
  doc["lng"] = gpsLng;
  doc["speed"] = gpsSpeed;
  doc["heading"] = gpsHeading;
  doc["satellites"] = gpsSatellites;

  doc["aX"] = accelX;
  doc["aY"] = accelY;
  doc["aZ"] = accelZ;
  doc["gX"] = gyroX;
  doc["gY"] = gyroY;
  doc["gZ"] = gyroZ;
  doc["pitch"] = pitch;
  doc["roll"] = roll;
  doc["yaw"] = yaw;

  doc["pressure"] = bmpPressure;
  doc["altitude"] = bmpAltitude;

  doc["temperature"] = dhtTemp;
  doc["humidity"] = dhtHumidity;

  doc["airQuality"] = airQualityPPM;
  doc["motionDetected"] = motionDetected;
  doc["pirStatus"] = isCalibrating ? "CALIBRATING" : "OK";
  doc["batteryVoltage"] = 3.30;
  doc["sd"] = false;
  doc["sdStatus"] = "NOT_PRESENT";

  String output;
  serializeJson(doc, output);

  webSocket.sendTXT(output);
}
