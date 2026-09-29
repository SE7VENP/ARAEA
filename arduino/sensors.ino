/*
  ============================================================
  FILE: arduino/sensors.ino
  PROJECT: AIoT Music Ambient System
  SENSORS: DHT22 (Temp+Humidity), BH1750 (Light), PIR (Motion)
  BOARD:   ESP32 DevKit C
  
  WIRING:
    DHT22:   DATA→GPIO4,  VCC→3.3V, GND→GND (10kΩ pull-up on DATA)
    BH1750:  SDA→GPIO21,  SCL→GPIO22, VCC→3.3V, GND→GND
    PIR:     OUT→GPIO15,  VCC→5V,  GND→GND

  LIBRARIES (Arduino Library Manager):
    - "DHT sensor library" by Adafruit
    - "Adafruit Unified Sensor" by Adafruit
    - "BH1750" by Christopher Laws

  SETUP:
    1. Edit WIFI_SSID, WIFI_PASSWORD, SERVER_IP below
    2. Tools → Board → ESP32 Dev Module
    3. Upload → Open Serial Monitor at 115200 baud
  ============================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"
#include <Wire.h>
#include <BH1750.h>

// ── CONFIG — EDIT THESE ─────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_IP     = "192.168.1.100";   // Your PC's local IP (run ipconfig/ifconfig)
const int   SERVER_PORT   = 3001;
const int   SEND_INTERVAL = 5000;              // ms between readings

// ── PINS ─────────────────────────────────────────────────
#define DHT_PIN    4
#define DHT_TYPE   DHT22
#define PIR_PIN    15
#define SDA_PIN    21
#define SCL_PIN    22

// ── OBJECTS ──────────────────────────────────────────────
DHT   dht(DHT_PIN, DHT_TYPE);
BH1750 lightMeter;

// ── State ─────────────────────────────────────────────────
float    temperature  = 22.0;
float    humidity     = 55.0;
float    lightLux     = 300.0;
bool     motionDetect = false;
bool     pirState     = false;
unsigned long lastSend    = 0;
unsigned long lastMotion  = 0;
String   serverURL;

// ── WiFi connect ─────────────────────────────────────────
void connectWiFi() {
  Serial.print("\n[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] ✅ Connected!");
    Serial.print("[WiFi] IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] ❌ Failed — check credentials");
    ESP.restart();
  }
}

// ── Read all sensors ──────────────────────────────────────
void readSensors() {
  // DHT22
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) temperature = t;
  if (!isnan(h)) humidity    = h;

  // BH1750
  float lux = lightMeter.readLightLevel();
  if (lux >= 0) lightLux = lux;

  // PIR — motion with 10-second sticky
  bool rawPir = digitalRead(PIR_PIN) == HIGH;
  if (rawPir) lastMotion = millis();
  motionDetect = (millis() - lastMotion) < 10000;
}

// ── Send JSON to server ───────────────────────────────────
void sendData() {
  if (WiFi.status() != WL_CONNECTED) { connectWiFi(); return; }

  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  StaticJsonDocument<256> doc;
  doc["temperature"] = round(temperature * 10.0) / 10.0;
  doc["humidity"]    = round(humidity    * 10.0) / 10.0;
  doc["light"]       = round(lightLux);
  doc["motion"]      = motionDetect;

  String body;
  serializeJson(doc, body);

  Serial.printf("[HTTP] Sending → %s\n", body.c_str());
  int code = http.POST(body);
  
  if (code == 200) {
    String resp = http.getString();
    Serial.printf("[HTTP] ✅ %d — context: %s\n", code, resp.c_str());
  } else {
    Serial.printf("[HTTP] ❌ Failed: %d\n", code);
  }
  http.end();
}

// ── Print readings to Serial ──────────────────────────────
void printReadings() {
  Serial.printf(
    "[Sensors] Temp: %.1f°C | Humidity: %.1f%% | Light: %.0f lux | Motion: %s\n",
    temperature, humidity, lightLux, motionDetect ? "YES" : "NO"
  );
}

// ── LED status indicator ──────────────────────────────────
void blinkLED(int times, int delayMs = 100) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_BUILTIN, HIGH); delay(delayMs);
    digitalWrite(LED_BUILTIN, LOW);  delay(delayMs);
  }
}

// ── Setup ─────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n╔══════════════════════════════════╗");
  Serial.println("║  AIoT Music Sensor Node v2.0     ║");
  Serial.println("╚══════════════════════════════════╝");

  // LED
  pinMode(LED_BUILTIN, OUTPUT);
  
  // PIR
  pinMode(PIR_PIN, INPUT);

  // DHT22
  dht.begin();
  Serial.println("[DHT22] Initialized");

  // BH1750 (I2C)
  Wire.begin(SDA_PIN, SCL_PIN);
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("[BH1750] Initialized");
  } else {
    Serial.println("[BH1750] ⚠️ Not found — using default 300 lux");
  }

  // Build server URL
  serverURL = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/sensors";
  Serial.println("[Server] URL: " + serverURL);

  // WiFi
  connectWiFi();

  // Initial warmup delay (PIR needs 30s to stabilise, DHT22 needs 2s)
  Serial.println("[Init] Warming up sensors (5s)...");
  for (int i = 5; i > 0; i--) {
    Serial.printf("[Init] %ds...\n", i);
    delay(1000);
  }

  blinkLED(3, 200); // Ready signal
  Serial.println("[Init] ✅ Ready!\n");
}

// ── Main loop ─────────────────────────────────────────────
void loop() {
  readSensors();

  unsigned long now = millis();
  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;
    printReadings();
    sendData();
    blinkLED(1);  // Blink once per send
  }

  // WiFi watchdog — reconnect if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Lost connection — reconnecting...");
    WiFi.reconnect();
    delay(5000);
  }
}
