/*
 * LollyD Travel Sensor — Standalone ESP32 (Plug & Play Wi-Fi)
 * ============================================================
 * Powers from ANY USB power bank / wall adapter / car charger.
 * Connects directly to Wi-Fi and streams sensor JSON over WebSockets
 * to the cloud relay server (wss://lollyd-relay.onrender.com).
 *
 * NO LAPTOP OR USB BRIDGE SERVER REQUIRED!
 *
 * HARDWARE:
 *   ESP32 Development Board
 *   NEO-6M GPS       → HardwareSerial2 (RX2=GPIO16, TX2=GPIO17)
 *   MPU-6050 IMU     → I2C (SDA=GPIO21, SCL=GPIO22) addr 0x68
 *   BMP280           → I2C (SDA=GPIO21, SCL=GPIO22) addr 0x76
 *   DHT11            → GPIO4
 *   MQ-135           → GPIO36 (VP / Analog A0)
 *   HC-SR501 PIR     → GPIO5
 *
 * REQUIRED LIBRARIES (install via Arduino Library Manager):
 *   - WebSockets (by Markus Sattler)
 *   - ArduinoJson (by Benoit Blanchon)
 *   - TinyGPSPlus
 *   - DHT sensor library (Adafruit)
 *   - Adafruit BMP280 Library
 *   - Adafruit Unified Sensor
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Wire.h>
#include <TinyGPSPlus.h>
#include <DHT.h>
#include <Adafruit_BMP280.h>
#include <ArduinoJson.h>

// ─── CONFIGURATION ──────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";      // Change to your Wi-Fi name / Mobile Hotspot
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // Change to your Wi-Fi password

// Cloud Relay WebSocket Server
const char* WS_HOST = "lollyd-relay.onrender.com"; // Render.com host
const int   WS_PORT = 443;                          // SSL port for wss://
const char* WS_PATH = "/";
const char* RELAY_KEY = "lollyd-travel-2024";

// ─── PIN CONFIGURATION (ESP32) ──────────────
#define GPS_RX_PIN    16   // ESP32 RX2 ← GPS TX
#define GPS_TX_PIN    17   // ESP32 TX2 → GPS RX
#define DHT_PIN       4    // DHT11 Data
#define DHT_TYPE      DHT11
#define MQ135_PIN     36   // VP / Analog pin
#define PIR_PIN       5    // Motion sensor
#define MPU_ADDR      0x68

// ─── OBJECTS ────────────────────────────────
HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_BMP280 bmp;
WebSocketsClient webSocket;

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
float supplyVoltage = 3.3;
bool bmpReady = false;
bool wsConnected = false;

// ─── WEBSOCKET EVENTS ───────────────────────
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from Cloud Relay");
      wsConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.println("[WS] Connected to Cloud Relay!");
      wsConnected = true;
      // Authenticate as publisher
      webSocket.sendTXT("{\"role\":\"publisher\",\"key\":\"" + String(RELAY_KEY) + "\"}");
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Received: %s\n", payload);
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=================================");
  Serial.println(" LollyD Travel Sensor — Standalone ESP32");
  Serial.println("=================================");

  // ── Init Sensors ──
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  dht.begin();
  Wire.begin(21, 22); // SDA=21, SCL=22

  // Init MPU-6050
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  Wire.endTransmission(true);

  // Init BMP280
  if (bmp.begin(0x76)) {
    bmpReady = true;
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                    Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16,
                    Adafruit_BMP280::FILTER_X16,
                    Adafruit_BMP280::STANDBY_MS_500);
    Serial.println("✅ BMP280 initialized");
  } else {
    Serial.println("⚠️ BMP280 not found at 0x76");
  }

  pinMode(PIR_PIN, INPUT);

  // ── Connect to Wi-Fi ──
  Serial.printf("Connecting to Wi-Fi: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⚠️ Wi-Fi connection timed out. Will keep trying in background...");
  }

  // ── Init WebSocket Client (wss:// SSL) ──
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();

  // Feed GPS
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Send telemetry every 1s
  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();

    readSensors();

    if (wsConnected) {
      sendTelemetryJSON();
    } else {
      Serial.println("📡 Reading sensors... (Waiting for WebSocket connection)");
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
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)14, (uint8_t)true);

  int16_t rawAx = Wire.read() << 8 | Wire.read();
  int16_t rawAy = Wire.read() << 8 | Wire.read();
  int16_t rawAz = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();
  int16_t rawGx = Wire.read() << 8 | Wire.read();
  int16_t rawGy = Wire.read() << 8 | Wire.read();
  int16_t rawGz = Wire.read() << 8 | Wire.read();

  accelX = rawAx / 16384.0;
  accelY = rawAy / 16384.0;
  accelZ = rawAz / 16384.0;
  gyroX  = rawGx / 131.0;
  gyroY  = rawGy / 131.0;
  gyroZ  = rawGz / 131.0;

  pitch = atan2(accelY, sqrt(accelX * accelX + accelZ * accelZ)) * 180.0 / PI;
  roll  = atan2(-accelX, accelZ) * 180.0 / PI;
  yaw += gyroZ * (SEND_INTERVAL / 1000.0);

  // BMP280
  if (bmpReady) {
    bmpPressure = bmp.readPressure() / 100.0F;
    bmpAltitude = bmp.readAltitude(1013.25);
  }

  // DHT11
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) dhtTemp = t;
  if (!isnan(h)) dhtHumidity = h;

  // MQ-135
  airQualityRaw = analogRead(MQ135_PIN);
  airQualityPPM = (float)map(airQualityRaw, 0, 4095, 10, 1000);

  // PIR
  motionDetected = digitalRead(PIR_PIN) == HIGH;
}

void sendTelemetryJSON() {
  StaticJsonDocument<512> doc;

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
  doc["batteryVoltage"] = 3.30;

  String output;
  serializeJson(doc, output);

  webSocket.sendTXT(output);
  Serial.println("📡 Telemetry sent to cloud: " + output);
}
