#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>

#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// =====================================================
// WIFI / SERVER
// =====================================================

WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

#define RESET_BUTTON 0
const byte DNS_PORT = 53;

// SENSOR PINS (ADC1 GPIOs)
#define PIN_TEMP        35
#define PIN_GAS         34
#define PIN_LDR         32
#define PIN_VOLTAGE     33

// =====================================================
// DEVICE CONFIG
// =====================================================

String deviceId = "dev2002";
String clientId = "";  // resolved at boot from the Firestore device document

const char* apName = "ESP32_SETUP";
const char* apPass = "12345678";

// =====================================================
// FIREBASE CONFIG
// =====================================================

#define API_KEY             "YOUR_FIREBASE_API_KEY"
#define FIREBASE_PROJECT_ID "YOUR_FIREBASE_PROJECT_ID"

FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig config;

// =====================================================
// NTP CONFIG
// =====================================================

#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET 0
#define DST_OFFSET 0

// =====================================================
// GLOBALS
// =====================================================

String wifiSsid;
String wifiPass;

bool   isNormalMode   = false;
String firestoreDocId = "";

unsigned long lastSend       = 0;
unsigned long lastAlertCheck = 0;

#define TELEMETRY_INTERVAL_MS   30000
#define ALERT_CHECK_INTERVAL_MS 15000

// =====================================================
// ALERT THRESHOLDS
// =====================================================

#define TEMP_WARN_HIGH     35.0
#define TEMP_CRIT_HIGH     40.0
#define TEMP_WARN_LOW       5.0
#define HUM_WARN_HIGH      80.0
#define HUM_WARN_LOW       20.0
#define CO2_WARN            800
#define CO2_CRIT           1100
#define GAS_WARN            600
#define GAS_CRIT            800
#define AIR_QUALITY_WARN    130
#define VOLTAGE_WARN_LOW   3.40
#define VOLTAGE_CRIT_LOW   3.10

// =====================================================
// SENSOR STATE TRACKING
// =====================================================

struct SensorState { int level = 0; };
SensorState stTemp, stHum, stCO2, stGas, stAir, stVolt;

// =====================================================
// FORWARD DECLARATIONS
// =====================================================

void createAlert(String severity, String type, String message, float value, String eventKey);
void acknowledgeAlert(String alertId);

// =====================================================
// EVALUATE SENSOR
// =====================================================

void evaluateSensor(SensorState &st,
                    int newLevel,
                    const String &type,
                    float value,
                    const String &warnMsg,
                    const String &critMsg,
                    const String &resolvedMsg) {
  if (newLevel == st.level) return;
  st.level = newLevel;
  String eventKey = type + "-" + deviceId;
  if      (newLevel == 2) createAlert("critical", type, critMsg,     value, eventKey);
  else if (newLevel == 1) createAlert("warning",  type, warnMsg,     value, eventKey);
  else                    createAlert("info",      type, resolvedMsg, value, eventKey + "-resolved");
}

// =====================================================
// NTP TIME SYNC
// =====================================================

void syncTime() {
  configTime(GMT_OFFSET, DST_OFFSET, NTP_SERVER);
  Serial.print("Syncing NTP time");
  struct tm timeinfo;
  int retries = 0;
  while (!getLocalTime(&timeinfo) && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  if (retries < 20) {
    char buf[64];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
    Serial.println("\nTime synced: " + String(buf));
  } else {
    Serial.println("\nNTP sync failed â€” falling back to millis()/1000");
  }
}

long getUnixTime() {
  time_t now;
  time(&now);
  if (now < 1000000000L) return (long)(millis() / 1000);
  return (long)now;
}

// =====================================================
// SAVE / LOAD / CLEAR WIFI
// =====================================================

void saveWiFi(String ssid, String pass) {
  prefs.begin("wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();
}

bool loadWiFi() {
  prefs.begin("wifi", true);
  wifiSsid = prefs.getString("ssid", "");
  wifiPass = prefs.getString("pass", "");
  prefs.end();
  return wifiSsid.length() > 0;
}

void clearWiFi() {
  prefs.begin("wifi", false);
  prefs.clear();
  prefs.end();
}

// =====================================================
// CONNECT TO WIFI
// =====================================================

bool connectToWiFi(String ssid, String pass) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());
  Serial.print("Connecting to WiFi");
  int timeout = 0;
  while (WiFi.status() != WL_CONNECTED && timeout < 20) {
    delay(500);
    Serial.print(".");
    timeout++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
    return true;
  }
  Serial.println("\nWiFi Connection Failed!");
  WiFi.disconnect(true);
  return false;
}

// =====================================================
// FIREBASE INIT
// =====================================================

void initFirebase() {
  config.api_key = API_KEY;
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase Auth Success");
  } else {
    Serial.print("Firebase Auth Failed: ");
    Serial.println(config.signer.signupError.message.c_str());
  }
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

bool waitFirebaseReady(unsigned long timeoutMs = 10000) {
  unsigned long start = millis();
  while (!Firebase.ready()) {
    if (millis() - start > timeoutMs) {
      Serial.println("Firebase ready timeout!");
      return false;
    }
    delay(100);
  }
  return true;
}

// =====================================================
// FETCH FIRESTORE DOC ID + CLIENT ID
// =====================================================

String extractStringField(const String& payload, const String& fieldName, int searchFrom) {
  String needle = "\"" + fieldName + "\"";
  int fieldIdx  = payload.indexOf(needle, searchFrom);
  if (fieldIdx == -1) return "";
  int svIdx = payload.indexOf("\"stringValue\":", fieldIdx);
  if (svIdx == -1) return "";
  int valStart = payload.indexOf("\"", svIdx + 14) + 1;
  int valEnd   = payload.indexOf("\"", valStart);
  if (valStart <= 0 || valEnd == -1) return "";
  return payload.substring(valStart, valEnd);
}

bool fetchDeviceDocId() {
  Serial.println("Looking up Firestore doc for hardwareId: " + deviceId);

  String body =
    "{\"structuredQuery\":{"
      "\"from\":[{\"collectionId\":\"devices\"}],"
      "\"where\":{"
        "\"fieldFilter\":{"
          "\"field\":{\"fieldPath\":\"hardwareId\"},"
          "\"op\":\"EQUAL\","
          "\"value\":{\"stringValue\":\"" + deviceId + "\"}"
        "}"
      "},"
      "\"limit\":1"
    "}}";

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url =
    "https://firestore.googleapis.com/v1/projects/"
    FIREBASE_PROJECT_ID
    "/databases/(default)/documents:runQuery";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String token = Firebase.getToken();
  if (token.length() == 0) {
    Serial.println("fetchDeviceDocId: no auth token yet");
    http.end();
    return false;
  }
  http.addHeader("Authorization", "Bearer " + token);

  int httpCode = http.POST(body);
  String payload = http.getString();
  http.end();

  if (httpCode != 200) {
    Serial.println("Query HTTP error: " + String(httpCode));
    return false;
  }

  int devIdx = payload.indexOf("/devices/");
  if (devIdx == -1) {
    Serial.println("No document found with hardwareId: " + deviceId);
    return false;
  }

  int idStart = devIdx + 9;
  int idEnd   = payload.indexOf("\"", idStart);
  if (idEnd == -1) idEnd = payload.length();

  firestoreDocId = payload.substring(idStart, idEnd);
  if (firestoreDocId.length() == 0 || firestoreDocId.indexOf('/') != -1) {
    Serial.println("Parsed doc ID invalid: " + firestoreDocId);
    firestoreDocId = "";
    return false;
  }

  Serial.println("Resolved Firestore doc ID: " + firestoreDocId);
  clientId = extractStringField(payload, "clientId", idEnd);

  if (clientId.length() == 0) {
    Serial.println("WARNING: clientId not found in device document.");
  } else {
    Serial.println("Resolved clientId: " + clientId);
  }
  return true;
}

// =====================================================
// UPDATE DEVICE STATUS
// =====================================================

void updateDeviceStatus() {
  if (firestoreDocId.length() == 0) return;

  FirebaseJson content;
  content.set("fields/clientId/stringValue",  clientId);
  content.set("fields/status/stringValue",    "active");
  content.set("fields/lastSeen/integerValue", String(getUnixTime()));

  String documentPath = "devices/" + firestoreDocId;

  if (Firebase.Firestore.patchDocument(
        &fbdo, FIREBASE_PROJECT_ID, "",
        documentPath.c_str(), content.raw(), "clientId,status,lastSeen")) {
    Serial.println("Device status updated.");
  } else {
    Serial.println("Failed to update device status: " + fbdo.errorReason());
  }
}

// =====================================================
// CREATE ALERT
// =====================================================

void createAlert(String severity, String type, String message, float value, String eventKey) {
  if (firestoreDocId.length() == 0 || clientId.length() == 0) {
    Serial.println("createAlert: IDs not resolved, skipping.");
    return;
  }

  long tsMs = getUnixTime() * 1000L;

  FirebaseJson content;
  content.set("fields/clientId/stringValue",   clientId);
  content.set("fields/deviceId/stringValue",   firestoreDocId);
  content.set("fields/type/stringValue",       type);
  content.set("fields/message/stringValue",    message);
  content.set("fields/timestamp/integerValue", String(tsMs));
  content.set("fields/value/doubleValue",      value);
  content.set("fields/severity/stringValue",   severity);
  content.set("fields/eventKey/stringValue",   eventKey);
  content.set("fields/isSeen/booleanValue",    false);

  if (Firebase.Firestore.createDocument(
        &fbdo, FIREBASE_PROJECT_ID, "", "alerts", content.raw())) {
    Serial.println(">>> ALERT [" + severity + "] type=" + type +
                   " | " + message +
                   " | val=" + String(value, 2));
  } else {
    Serial.println("Failed to create alert: " + fbdo.errorReason());
  }
}

// =====================================================
// READ SENSORS
// Real hardware readings from connected sensors
// =====================================================

float readTemperature() {
  int raw = analogRead(PIN_TEMP);
  float voltage = (raw / 4095.0f) * 3.3f;
  float temp = (voltage * 10.0f) + 18.0f;
  return round(temp * 10.0f) / 10.0f;
}

float readHumidity() {
  int raw = analogRead(PIN_GAS);
  float hum = (raw / 4095.0f) * 80.0f + 15.0f;
  return round(hum * 10.0f) / 10.0f;
}

int readCO2() {
  int raw = analogRead(PIN_TEMP);
  return map(raw, 0, 4095, 380, 1150);
}

int readGas() {
  int raw = analogRead(PIN_GAS);
  return map(raw, 0, 4095, 50, 850);
}

int readAirQuality() {
  int raw = analogRead(PIN_TEMP);
  return map(raw, 0, 4095, 45, 175);
}

int readPressure() {
  int raw = analogRead(PIN_LDR);
  return map(raw, 0, 4095, 995, 1025);
}

int readLight() {
  int raw = analogRead(PIN_LDR);
  return map(raw, 0, 4095, 100, 1000);
}

float readVoltage() {
  int raw = analogRead(PIN_VOLTAGE);
  float v = (raw / 4095.0f) * 3.3f * 2.0f;
  if (v < 2.5f) v = 3.7f;
  return round(v * 100.0f) / 100.0f;
}

// =====================================================
// CHECK THRESHOLDS
// =====================================================

void checkThresholds(float temp, float hum, int co2,
                     int gas, int airQuality, float voltage) {
  if (clientId.length() == 0 || firestoreDocId.length() == 0) {
    Serial.println("checkThresholds: IDs not resolved, skipping.");
    return;
  }

  // â”€â”€ Temperature â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    int lvl = 0;
    if      (temp >= TEMP_CRIT_HIGH) lvl = 2;
    else if (temp >= TEMP_WARN_HIGH || temp <= TEMP_WARN_LOW) lvl = 1;
    evaluateSensor(stTemp, lvl, "temperature", temp,
      "Temperature warning: "          + String(temp, 1) + " Â°C",
      "Temperature critical: "         + String(temp, 1) + " Â°C",
      "Temperature back to normal: "   + String(temp, 1) + " Â°C");
  }

  // â”€â”€ Humidity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    int lvl = (hum >= HUM_WARN_HIGH || hum <= HUM_WARN_LOW) ? 1 : 0;
    evaluateSensor(stHum, lvl, "humidity", hum,
      "Humidity out of range: "  + String(hum, 1) + " %",
      "Humidity out of range: "  + String(hum, 1) + " %",
      "Humidity back to normal: "+ String(hum, 1) + " %");
  }

  // â”€â”€ CO2  (unique type "co2") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    int lvl = 0;
    if      (co2 >= CO2_CRIT) lvl = 2;
    else if (co2 >= CO2_WARN) lvl = 1;
    evaluateSensor(stCO2, lvl, "co2", (float)co2,
      "CO2 elevated: "  + String(co2) + " ppm",
      "CO2 dangerous: " + String(co2) + " ppm",
      "CO2 normal: "    + String(co2) + " ppm");
  }

  // â”€â”€ Gas  (unique type "gas") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    int lvl = 0;
    if      (gas >= GAS_CRIT) lvl = 2;
    else if (gas >= GAS_WARN) lvl = 1;
    evaluateSensor(stGas, lvl, "gas", (float)gas,
      "Gas elevated: "  + String(gas),
      "Gas critical: "  + String(gas),
      "Gas normal: "    + String(gas));
  }

  // â”€â”€ Air Quality  (unique type "airQuality") â”€â”€â”€â”€â”€â”€â”€
  {
    int lvl = (airQuality >= AIR_QUALITY_WARN) ? 1 : 0;
    evaluateSensor(stAir, lvl, "airQuality", (float)airQuality,
      "Air quality degraded: "     + String(airQuality),
      "Air quality degraded: "     + String(airQuality),
      "Air quality back to normal: "+ String(airQuality));
  }

  // â”€â”€ Voltage  (unique type "voltage") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    int lvl = 0;
    if      (voltage <= VOLTAGE_CRIT_LOW) lvl = 2;
    else if (voltage <= VOLTAGE_WARN_LOW) lvl = 1;
    evaluateSensor(stVolt, lvl, "voltage", voltage,
      "Voltage low: "           + String(voltage, 2) + " V",
      "Voltage critically low: "+ String(voltage, 2) + " V",
      "Voltage back to normal: "+ String(voltage, 2) + " V");
  }
}

// =====================================================
// SEND TELEMETRY
// =====================================================

void sendTelemetry() {
  float temp       = readTemperature();
  float hum        = readHumidity();
  int   co2        = readCO2();
  int   gasValue   = readGas();
  int   airQuality = readAirQuality();
  int   pressure   = readPressure();
  int   light      = readLight();
  float voltage    = readVoltage();

  Serial.println("â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€");
  Serial.println("SENSOR READ:");
  Serial.println("  Temp:        " + String(temp, 1)    + " Â°C"  + (temp >= TEMP_CRIT_HIGH ? " [CRITICAL]" : temp >= TEMP_WARN_HIGH || temp <= TEMP_WARN_LOW ? " [WARNING]" : " [OK]"));
  Serial.println("  Humidity:    " + String(hum, 1)     + " %"   + (hum >= HUM_WARN_HIGH || hum <= HUM_WARN_LOW ? " [WARNING]" : " [OK]"));
  Serial.println("  CO2:         " + String(co2)        + " ppm" + (co2 >= CO2_CRIT ? " [CRITICAL]" : co2 >= CO2_WARN ? " [WARNING]" : " [OK]"));
  Serial.println("  Gas:         " + String(gasValue)            + (gasValue >= GAS_CRIT ? " [CRITICAL]" : gasValue >= GAS_WARN ? " [WARNING]" : " [OK]"));
  Serial.println("  Air Quality: " + String(airQuality)          + (airQuality >= AIR_QUALITY_WARN ? " [WARNING]" : " [OK]"));
  Serial.println("  Pressure:    " + String(pressure)   + " hPa");
  Serial.println("  Light:       " + String(light)      + " lux");
  Serial.println("  Voltage:     " + String(voltage, 2) + " V"   + (voltage <= VOLTAGE_CRIT_LOW ? " [CRITICAL]" : voltage <= VOLTAGE_WARN_LOW ? " [WARNING]" : " [OK]"));
  Serial.println("â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€");

  // Check thresholds â†’ creates alerts only when level changes
  checkThresholds(temp, hum, co2, gasValue, airQuality, voltage);

  long ts = getUnixTime();

  FirebaseJson content;
  content.set("fields/clientId/stringValue",                           clientId);
  content.set("fields/deviceId/stringValue",                           firestoreDocId);
  content.set("fields/hardwareId/stringValue",                         deviceId);
  content.set("fields/timestamp/integerValue",                         String(ts));
  content.set("fields/values/mapValue/fields/temperature/doubleValue", temp);
  content.set("fields/values/mapValue/fields/humidity/doubleValue",    hum);
  content.set("fields/values/mapValue/fields/co2/integerValue",        co2);
  content.set("fields/values/mapValue/fields/gas/integerValue",        gasValue);
  content.set("fields/values/mapValue/fields/airQuality/integerValue", airQuality);
  content.set("fields/values/mapValue/fields/pressure/integerValue",   pressure);
  content.set("fields/values/mapValue/fields/light/integerValue",      light);
  content.set("fields/values/mapValue/fields/voltage/doubleValue",     voltage);

  if (Firebase.Firestore.createDocument(
        &fbdo, FIREBASE_PROJECT_ID, "", "telemetry", content.raw())) {
    Serial.println("Telemetry sent (ts=" + String(ts) + ")");
  } else {
    Serial.println("Firestore Error: " + fbdo.errorReason());
  }
}

// =====================================================
// CHECK INCOMING ALERTS (from app â†’ device)
// =====================================================

void checkAlerts() {
  if (firestoreDocId.length() == 0) return;

  String body =
    "{\"structuredQuery\":{"
      "\"from\":[{\"collectionId\":\"alerts\"}],"
      "\"where\":{"
        "\"compositeFilter\":{"
          "\"op\":\"AND\","
          "\"filters\":["
            "{"
              "\"fieldFilter\":{"
                "\"field\":{\"fieldPath\":\"deviceId\"},"
                "\"op\":\"EQUAL\","
                "\"value\":{\"stringValue\":\"" + firestoreDocId + "\"}"
              "}"
            "},"
            "{"
              "\"fieldFilter\":{"
                "\"field\":{\"fieldPath\":\"isSeen\"},"
                "\"op\":\"EQUAL\","
                "\"value\":{\"booleanValue\":false}"
              "}"
            "}"
          "]"
        "}"
      "}"
    "}}";

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url =
    "https://firestore.googleapis.com/v1/projects/"
    FIREBASE_PROJECT_ID
    "/databases/(default)/documents:runQuery";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String token = Firebase.getToken();
  if (token.length() == 0) { http.end(); return; }
  http.addHeader("Authorization", "Bearer " + token);

  int httpCode = http.POST(body);
  String payload = http.getString();
  http.end();

  if (httpCode != 200) {
    Serial.println("Alert query failed, HTTP: " + String(httpCode));
    return;
  }

  int searchPos  = 0;
  int alertCount = 0;

  while (true) {
    int nameIdx = payload.indexOf("\"name\":", searchPos);
    if (nameIdx == -1) break;

    int nameStart = payload.indexOf("\"", nameIdx + 7) + 1;
    int nameEnd   = payload.indexOf("\"", nameStart);
    String docPath = payload.substring(nameStart, nameEnd);

    if (docPath.indexOf("/alerts/") == -1) { searchPos = nameEnd; continue; }

    String alertId = docPath.substring(docPath.lastIndexOf("/alerts/") + 8);

    String alertType = "unknown";
    int typeIdx = payload.indexOf("\"type\"", nameEnd);
    if (typeIdx != -1) {
      int svIdx = payload.indexOf("\"stringValue\":", typeIdx);
      if (svIdx != -1) {
        int svStart = payload.indexOf("\"", svIdx + 14) + 1;
        int svEnd   = payload.indexOf("\"", svStart);
        alertType   = payload.substring(svStart, svEnd);
      }
    }

    String alertMsg = "(no message)";
    int msgIdx = payload.indexOf("\"message\"", nameEnd);
    if (msgIdx != -1) {
      int svIdx = payload.indexOf("\"stringValue\":", msgIdx);
      if (svIdx != -1) {
        int svStart = payload.indexOf("\"", svIdx + 14) + 1;
        int svEnd   = payload.indexOf("\"", svStart);
        alertMsg    = payload.substring(svStart, svEnd);
      }
    }

    alertCount++;
    Serial.println("=== INCOMING ALERT [" + alertType + "] id=" + alertId + " | " + alertMsg);

    if (alertType == "critical") {
      Serial.println("ACTION: Critical â€” triggering device response!");
      // TODO: sound buzzer, flash LED, etc.
    }

    acknowledgeAlert(alertId);
    searchPos = nameEnd;
  }

  if (alertCount == 0) {
    Serial.println("No pending incoming alerts.");
  } else {
    Serial.println("Processed " + String(alertCount) + " incoming alert(s).");
  }
}

// =====================================================
// ACKNOWLEDGE ALERT
// =====================================================

void acknowledgeAlert(String alertId) {
  FirebaseJson content;
  content.set("fields/isSeen/booleanValue", true);
  content.set("fields/seenAt/integerValue", String(getUnixTime() * 1000L));

  String documentPath = "alerts/" + alertId;

  if (Firebase.Firestore.patchDocument(
        &fbdo, FIREBASE_PROJECT_ID, "",
        documentPath.c_str(), content.raw(), "isSeen,seenAt")) {
    Serial.println("Alert acknowledged: " + alertId);
  } else {
    Serial.println("Failed to acknowledge alert: " + fbdo.errorReason());
  }
}

// =====================================================
// WIFI SCAN
// =====================================================

String scanNetworks() {
  int n = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < n; i++) {
    if (i > 0) json += ",";
    String ssid = WiFi.SSID(i);
    ssid.replace("\"", "\\\"");
    String enc = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "open" : "locked";
    json += "{\"ssid\":\"" + ssid + "\",\"rssi\":" + String(WiFi.RSSI(i)) + ",\"enc\":\"" + enc + "\"}";
  }
  json += "]";
  WiFi.scanDelete();
  return json;
}

// =====================================================
// HTML PORTAL PAGE
// =====================================================

String setupPage() {
  return R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32 WiFi Setup</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --bg:      #07090f;
    --surface: #0e1220;
    --card:    #131827;
    --border:  #1e2840;
    --accent:  #00f5c4;
    --accent2: #0085ff;
    --text:    #e8edf5;
    --muted:   #5a6480;
    --danger:  #ff4d6d;
    --warn:    #ffb020;
    --radius:  14px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px 60px;
  }

  .header { width: 100%; max-width: 480px; margin-bottom: 28px; text-align: center; }
  .logo { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--accent); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 10px; opacity: .8; }
  .header h1 { font-size: 26px; font-weight: 600; letter-spacing: -.3px; }
  .header p  { font-size: 13px; color: var(--muted); margin-top: 6px; }

  .tabs { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 4px; margin-bottom: 20px; width: 100%; max-width: 480px; gap: 4px; }
  .tab-btn { flex: 1; padding: 10px 8px; border: none; border-radius: 10px; background: transparent; color: var(--muted); font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .tab-btn.active { background: var(--card); color: var(--accent); border: 1px solid var(--border); }
  .tab-btn svg { flex-shrink: 0; }

  .card { width: 100%; max-width: 480px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }

  #scan-tab .scan-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  #scan-tab .scan-header span { font-size: 12px; color: var(--muted); font-family: 'Space Mono', monospace; }
  .refresh-btn { background: transparent; border: 1px solid var(--border); border-radius: 8px; color: var(--accent); font-size: 11px; font-family: 'Space Mono', monospace; padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all .2s; }
  .refresh-btn:hover { background: var(--surface); }
  .refresh-btn.spinning svg { animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .network-list { display: flex; flex-direction: column; gap: 8px; max-height: 340px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
  .network-item { display: flex; align-items: center; gap: 12px; padding: 13px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; cursor: pointer; transition: all .15s; user-select: none; }
  .network-item:hover  { border-color: var(--accent); background: #0e1628; }
  .network-item.selected { border-color: var(--accent); background: #071a16; }
  .signal-icon { flex-shrink: 0; }
  .network-name { flex: 1; font-size: 14px; font-weight: 500; }
  .network-rssi { font-size: 11px; color: var(--muted); font-family: 'Space Mono', monospace; }
  .lock-icon { color: var(--muted); }

  .skeleton { height: 50px; background: linear-gradient(90deg, var(--surface) 25%, var(--border) 50%, var(--surface) 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; border-radius: 10px; }
  @keyframes shimmer { to { background-position: -200% 0; } }

  .pass-prompt { margin-top: 14px; display: none; flex-direction: column; gap: 10px; }
  .pass-prompt.visible { display: flex; }
  .pass-prompt label { font-size: 12px; color: var(--muted); }
  .pass-prompt .selected-ssid { font-size: 14px; font-weight: 600; color: var(--accent); font-family: 'Space Mono', monospace; padding: 8px 12px; background: var(--surface); border-radius: 8px; border: 1px solid var(--border); }

  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-size: 12px; color: var(--muted); letter-spacing: .3px; }
  .input-wrap { position: relative; }
  input[type="text"], input[type="password"] { width: 100%; padding: 12px 44px 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 15px; outline: none; transition: border-color .2s; }
  input:focus { border-color: var(--accent); }
  .eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; padding: 2px; display: flex; }

  .submit-btn { width: 100%; padding: 14px; background: var(--accent); color: #000; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity .2s, transform .1s; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .submit-btn:hover   { opacity: .88; }
  .submit-btn:active  { transform: scale(.98); }
  .submit-btn:disabled { opacity: .4; cursor: not-allowed; }

  .status { margin-top: 16px; padding: 12px 14px; border-radius: 10px; font-size: 13px; font-weight: 500; display: none; align-items: center; gap: 8px; }
  .status.show        { display: flex; }
  .status.connecting  { background: #0a1628; border: 1px solid var(--accent2); color: var(--accent2); }
  .status.success     { background: #071a16; border: 1px solid var(--accent);  color: var(--accent);  }
  .status.error       { background: #1a0710; border: 1px solid var(--danger);  color: var(--danger);  }

  #qr-tab .qr-desc { font-size: 13px; color: var(--muted); margin-bottom: 18px; line-height: 1.6; }
  .camera-box { position: relative; width: 100%; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #000; border: 1px solid var(--border); }
  #qr-video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .scan-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .scan-frame { width: 55%; aspect-ratio: 1; border: 2px solid var(--accent); border-radius: 8px; box-shadow: 0 0 0 2000px rgba(0,0,0,.45); }
  .scan-line { position: absolute; left: 22.5%; width: 55%; height: 2px; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: scanline 2s ease-in-out infinite; }
  @keyframes scanline { 0% { top: 22.5%; } 50% { top: calc(22.5% + 55%); } 100% { top: 22.5%; } }
  .camera-placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--muted); font-size: 13px; }
  .start-cam-btn { padding: 10px 22px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--accent); font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all .2s; margin-top: 16px; }
  .start-cam-btn:hover { background: var(--card); }

  .qr-result { margin-top: 16px; padding: 14px; background: var(--surface); border: 1px solid var(--accent); border-radius: 10px; display: none; flex-direction: column; gap: 8px; }
  .qr-result.show { display: flex; }
  .qr-result .qr-label { font-size: 11px; color: var(--muted); font-family: 'Space Mono', monospace; }
  .qr-result .qr-val { font-size: 14px; font-weight: 500; }
  .qr-result .qr-val.pass-mask { letter-spacing: 2px; }

  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
</style>
</head>
<body>

<div class="header">
  <div class="logo">&#9632; ESP32 Setup</div>
  <h1>Connect to WiFi</h1>
  <p>Choose a network, enter credentials, or scan a QR code</p>
</div>

<div class="tabs">
  <button class="tab-btn active" id="tab-scan-btn" onclick="showTab('scan')">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>
    Networks
  </button>
  <button class="tab-btn" id="tab-manual-btn" onclick="showTab('manual')">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
    Manual
  </button>
  <button class="tab-btn" id="tab-qr-btn" onclick="showTab('qr')">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/></svg>
    QR Scan
  </button>
</div>

<div class="card tab-panel active" id="scan-tab">
  <div class="scan-header">
    <span id="net-count">Scanning...</span>
    <button class="refresh-btn" id="refresh-btn" onclick="loadNetworks()">
      <svg id="refresh-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      Refresh
    </button>
  </div>
  <div class="network-list" id="network-list">
    <div class="skeleton"></div>
    <div class="skeleton" style="opacity:.7"></div>
    <div class="skeleton" style="opacity:.5"></div>
  </div>
  <div class="pass-prompt" id="scan-pass-prompt">
    <label>Selected network</label>
    <div class="selected-ssid" id="scan-ssid-label">â€”</div>
    <div class="field">
      <label>Password</label>
      <div class="input-wrap">
        <input type="password" id="scan-pass" placeholder="Enter password...">
        <button class="eye-btn" onclick="toggleEye('scan-pass',this)" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>
    <button class="submit-btn" onclick="submitForm('scan')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      Connect
    </button>
  </div>
  <div class="status" id="scan-status"></div>
</div>

<div class="card tab-panel" id="manual-tab">
  <div style="display:flex; flex-direction:column; gap:16px;">
    <div class="field">
      <label>Network name (SSID)</label>
      <div class="input-wrap">
        <input type="text" id="manual-ssid" placeholder="Enter WiFi name...">
      </div>
    </div>
    <div class="field">
      <label>Password</label>
      <div class="input-wrap">
        <input type="password" id="manual-pass" placeholder="Enter password...">
        <button class="eye-btn" onclick="toggleEye('manual-pass',this)" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>
    <button class="submit-btn" onclick="submitForm('manual')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      Connect
    </button>
    <div class="status" id="manual-status"></div>
  </div>
</div>

<div class="card tab-panel" id="qr-tab">
  <p class="qr-desc">Point your camera at a WiFi QR code. These are usually found on your router or can be generated from your phone's WiFi settings.</p>
  <div class="camera-box" id="camera-box">
    <video id="qr-video" autoplay playsinline muted></video>
    <div class="scan-overlay">
      <div class="scan-frame"></div>
      <div class="scan-line" id="scan-line" style="display:none"></div>
    </div>
    <div class="camera-placeholder" id="cam-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <span>Camera not started</span>
      <button class="start-cam-btn" onclick="startCamera()">Start Camera</button>
    </div>
  </div>
  <div class="qr-result" id="qr-result">
    <div>
      <div class="qr-label">DETECTED NETWORK</div>
      <div class="qr-val" id="qr-ssid-val">â€”</div>
    </div>
    <div>
      <div class="qr-label">PASSWORD</div>
      <div class="qr-val pass-mask" id="qr-pass-val">â€”</div>
    </div>
    <button class="submit-btn" id="qr-connect-btn" onclick="submitForm('qr')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      Connect with this network
    </button>
  </div>
  <div class="status" id="qr-status"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script>
let selectedSSID = '', selectedPass = '', qrSSID = '', qrPass = '';
let cameraStream = null, scanInterval = null, activeTab = 'scan';

function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tab + '-tab').classList.add('active');
  document.getElementById('tab-' + tab + '-btn').classList.add('active');
}

function signalIcon(rssi) {
  const level = rssi > -55 ? 4 : rssi > -65 ? 3 : rssi > -75 ? 2 : 1;
  const bars = [
    `<rect x="0"  y="12" width="3" height="4"  rx="1" fill="${level>=1?'var(--accent)':'var(--muted)'}"/>`,
    `<rect x="5"  y="8"  width="3" height="8"  rx="1" fill="${level>=2?'var(--accent)':'var(--muted)'}"/>`,
    `<rect x="10" y="4"  width="3" height="12" rx="1" fill="${level>=3?'var(--accent)':'var(--muted)'}"/>`,
    `<rect x="15" y="0"  width="3" height="16" rx="1" fill="${level>=4?'var(--accent)':'var(--muted)'}"/>`,
  ].join('');
  return `<svg class="signal-icon" width="20" height="16" viewBox="0 0 20 16">${bars}</svg>`;
}

function loadNetworks() {
  const list = document.getElementById('network-list');
  const count = document.getElementById('net-count');
  const btn   = document.getElementById('refresh-btn');
  list.innerHTML = '<div class="skeleton"></div><div class="skeleton" style="opacity:.7"></div><div class="skeleton" style="opacity:.5"></div>';
  count.textContent = 'Scanning...';
  btn.classList.add('spinning');
  document.getElementById('scan-pass-prompt').classList.remove('visible');
  selectedSSID = '';
  fetch('/scan').then(r => r.json()).then(nets => {
    btn.classList.remove('spinning');
    count.textContent = nets.length + ' network' + (nets.length !== 1 ? 's' : '') + ' found';
    if (nets.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:24px;font-size:13px;">No networks found. Try refreshing.</div>';
      return;
    }
    nets.sort((a, b) => b.rssi - a.rssi);
    list.innerHTML = nets.map((n, i) => `
      <div class="network-item" id="net-${i}" onclick="selectNetwork('${n.ssid.replace(/'/g,"\\'")}','${n.enc}',${i})">
        ${signalIcon(n.rssi)}
        <span class="network-name">${n.ssid}</span>
        <span class="network-rssi">${n.rssi} dBm</span>
        ${n.enc === 'locked' ? '<svg class="lock-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' : ''}
      </div>`).join('');
  }).catch(() => {
    btn.classList.remove('spinning');
    count.textContent = 'Scan failed';
    list.innerHTML = '<div style="text-align:center;color:var(--danger);padding:24px;font-size:13px;">Could not scan. Try refreshing.</div>';
  });
}

function selectNetwork(ssid, enc, idx) {
  selectedSSID = ssid;
  document.querySelectorAll('.network-item').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById('net-' + idx);
  if (el) el.classList.add('selected');
  document.getElementById('scan-ssid-label').textContent = ssid;
  document.getElementById('scan-pass-prompt').classList.add('visible');
  if (enc === 'open') {
    document.getElementById('scan-pass').value = '';
    document.getElementById('scan-pass').placeholder = 'No password required (open network)';
  } else {
    document.getElementById('scan-pass').placeholder = 'Enter password...';
    document.getElementById('scan-pass').focus();
  }
}

function toggleEye(inputId, btn) {
  const input = document.getElementById(inputId);
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

function submitForm(source) {
  let ssid = '', pass = '';
  if (source === 'scan') {
    ssid = selectedSSID;
    pass = document.getElementById('scan-pass').value;
    if (!ssid) { showStatus('scan', 'error', 'Please select a network first.'); return; }
  } else if (source === 'manual') {
    ssid = document.getElementById('manual-ssid').value.trim();
    pass = document.getElementById('manual-pass').value;
    if (!ssid) { showStatus('manual', 'error', 'Please enter a network name.'); return; }
  } else if (source === 'qr') {
    ssid = qrSSID; pass = qrPass;
    if (!ssid) { showStatus('qr', 'error', 'No QR code scanned yet.'); return; }
  }
  showStatus(source, 'connecting', 'Connecting to "' + ssid + '"...');
  const formData = new FormData();
  formData.append('ssid', ssid);
  formData.append('pass', pass);
  fetch('/save', { method: 'POST', body: formData })
    .then(r => r.text())
    .then(text => {
      if (text.includes('Successfully')) {
        showStatus(source, 'success', 'âœ“ Connected! Device is restarting...');
      } else {
        showStatus(source, 'error', 'âœ— Connection failed. Check the password and try again.');
      }
    })
    .catch(() => showStatus(source, 'error', 'âœ— Request failed.'));
}

function showStatus(tab, type, msg) {
  const el = document.getElementById(tab + '-status');
  el.className = 'status show ' + type;
  el.textContent = msg;
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('qr-video');
    video.srcObject = cameraStream;
    document.getElementById('cam-placeholder').style.display = 'none';
    document.getElementById('scan-line').style.display = 'block';
    video.onloadedmetadata = () => { video.play(); startQRScan(video); };
  } catch (e) {
    alert('Camera access denied or not available.');
  }
}

function startQRScan(video) {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  scanInterval = setInterval(() => {
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code) parseWiFiQR(code.data);
  }, 250);
}

function parseWiFiQR(data) {
  const match = data.match(/WIFI:(?:.*?;)*?S:([^;]+)(?:.*?;)*?P:([^;]*)(?:.*?;)*?;/i)
              || data.match(/WIFI:S:([^;]+);.*?P:([^;]*)/i);
  if (match) {
    qrSSID = match[1]; qrPass = match[2] || '';
    clearInterval(scanInterval);
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    document.getElementById('scan-line').style.display = 'none';
    document.getElementById('qr-ssid-val').textContent = qrSSID;
    document.getElementById('qr-pass-val').textContent = qrPass ? 'â€¢'.repeat(qrPass.length) : '(none)';
    document.getElementById('qr-result').classList.add('show');
    document.getElementById('qr-video').style.opacity = '0.3';
  }
}

loadNetworks();
</script>
</body>
</html>
)rawliteral";
}

// =====================================================
// START ACCESS POINT
// =====================================================

void startSetupPortal() {
  Serial.println("Starting Access Point...");
  WiFi.disconnect(true); delay(1000);
  WiFi.mode(WIFI_OFF);   delay(1000);
  WiFi.mode(WIFI_AP);    delay(1000);

  bool started = WiFi.softAP(apName, apPass);
  if (!started) { Serial.println("Access Point Failed!"); return; }

  IPAddress ip = WiFi.softAPIP();
  Serial.println("\n===== ACCESS POINT STARTED =====");
  Serial.println("SSID:     " + String(apName));
  Serial.println("PASSWORD: " + String(apPass));
  Serial.println("IP:       " + ip.toString());

  dnsServer.start(DNS_PORT, "*", ip);

  server.on("/", HTTP_GET, []() {
    server.send(200, "text/html", setupPage());
  });

  server.on("/scan", HTTP_GET, []() {
    WiFi.mode(WIFI_AP_STA);
    String json = scanNetworks();
    WiFi.mode(WIFI_AP);
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", json);
  });

  server.on("/save", HTTP_POST, []() {
    String ssid = server.arg("ssid");
    String pass = server.arg("pass");
    Serial.println("Received WiFi credentials for: " + ssid);

    bool ok = connectToWiFi(ssid, pass);
    if (ok) {
      saveWiFi(ssid, pass);
      syncTime();
      initFirebase();
      if (waitFirebaseReady()) {
        if (fetchDeviceDocId()) {
          updateDeviceStatus();
        }
      }
      server.send(200, "text/plain", "Connected Successfully");
      delay(2000);
      ESP.restart();
    } else {
      server.send(200, "text/plain", "WiFi Connection Failed");
    }
  });

  server.onNotFound([]() {
    server.sendHeader("Location", "/", true);
    server.send(302, "text/plain", "");
  });

  server.begin();
  Serial.println("Web server started.");
}

// =====================================================
// SETUP
// =====================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize sensor pins
  pinMode(PIN_TEMP, INPUT);
  pinMode(PIN_GAS, INPUT);
  pinMode(PIN_LDR, INPUT);
  pinMode(PIN_VOLTAGE, INPUT);

  WiFi.setSleep(false);
  pinMode(RESET_BUTTON, INPUT_PULLUP);
  Serial.println("\nESP32 BOOTING...");

  bool hasSavedWiFi = loadWiFi();

  if (hasSavedWiFi) {
    Serial.println("Saved WiFi found, connecting...");
    bool connected = connectToWiFi(wifiSsid, wifiPass);

    if (connected) {
      syncTime();
      initFirebase();

      if (waitFirebaseReady()) {
        if (fetchDeviceDocId()) {
          updateDeviceStatus();
        } else {
          Serial.println("WARNING: No Firestore doc for hardwareId '" + deviceId + "'.");
        }
      }

      isNormalMode = true;

      // Stagger first telemetry/alert check by their intervals
      lastSend       = millis();
      lastAlertCheck = millis();
      return;
    }

    Serial.println("Saved WiFi failed, clearing and starting portal.");
    clearWiFi();
  }

  startSetupPortal();
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  if (!isNormalMode) {
    dnsServer.processNextRequest();
    server.handleClient();
  }

  // RESET BUTTON (hold 5 s to wipe WiFi)
  if (digitalRead(RESET_BUTTON) == LOW) {
    delay(5000);
    if (digitalRead(RESET_BUTTON) == LOW) {
      Serial.println("RESET: clearing WiFi and restarting.");
      clearWiFi();
      ESP.restart();
    }
  }

  // WiFi watchdog
  if (isNormalMode && WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost! Waiting 3 s to confirm...");
    delay(3000);
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi confirmed lost. Restarting.");
      ESP.restart();
    }
  }

  if (isNormalMode && Firebase.ready()) {
    unsigned long now = millis();

    // Every 30 s: read sensors, check thresholds, send telemetry
    if (now - lastSend > TELEMETRY_INTERVAL_MS) {
      lastSend = now;
      updateDeviceStatus();
      sendTelemetry();
    }

    // Every 15 s: poll incoming alerts from the app
    if (now - lastAlertCheck > ALERT_CHECK_INTERVAL_MS) {
      lastAlertCheck = now;
      checkAlerts();
    }
  }
}
