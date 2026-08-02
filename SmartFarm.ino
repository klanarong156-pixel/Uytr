#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <LittleFS.h>
#include <ESP8266WebServer.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <RTClib.h>
#include <WiFiManager.h>

// ==================== MQTT Config ====================
const char* mqtt_server = "650188a0ee2b4367b7c131fb385590a9.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "smartfarm";
const char* mqtt_pass = "Kla12345";
const char* mqtt_client_id = "SmartFarm_Uytr_V4"; // เปลี่ยน ID ทุกครั้งที่แก้โค้ดเพื่อเลี่ยงค้างใน Server

// ==================== Hardware Pins ====================
#define DHTPIN D3          
#define DHTTYPE DHT11
#define RELAY_PUMP D0      
#define RELAY_ZONE1 D5
#define RELAY_LIGHT_HOME D6
#define RELAY_LIGHT_SALA D7

// ==================== Objects ====================
DHT dht(DHTPIN, DHTTYPE);
WiFiClientSecure espClient;
PubSubClient client(espClient);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000);
ESP8266WebServer server(80);
RTC_DS3231 rtc;

// ==================== System Variables ====================
enum OperatingMode { MANUAL, AUTO };
OperatingMode currentMode = MANUAL;

struct RelaySchedule {
  bool enabled;
  int onHour, onMinute;
  int offHour, offMinute;
};

RelaySchedule pumpSchedule = {false, 0, 0, 0, 0};
RelaySchedule zone1Schedule = {false, 0, 0, 0, 0};
RelaySchedule lightHomeSchedule = {false, 0, 0, 0, 0};
RelaySchedule lightSalaSchedule = {false, 0, 0, 0, 0};

unsigned long lastSensorRead = 0;
unsigned long lastStatusUpdate = 0;
unsigned long lastRTCsync = 0;
bool rtcInitialized = false; // Track if RTC has been successfully initialized
const long sensorInterval = 30000;
const long statusInterval = 2000; 
const long rtcSyncInterval = 3600000; 

// ==================== Functions ====================

DateTime getValidatedDateTime() {
  // Try NTP first
  if (WiFi.status() == WL_CONNECTED && timeClient.update()) {
    DateTime ntpTime(timeClient.getEpochTime());
    if (ntpTime.year() > 2020) { // Basic validation for NTP time
      return ntpTime;
    }
  }

  // Fallback to RTC if NTP is not available or invalid
  if (rtcInitialized) {
    DateTime rtcTime = rtc.now();
    if (rtcTime.year() > 2020) { // Basic validation for RTC time
      return rtcTime;
    }
  }

  // If both fail, return a default/invalid DateTime (e.g., epoch 0)
  return DateTime(0);
}

void publishRelayStatus() {
  if (!client.connected()) return;
  client.publish("smartfarm/relay/pump/status", (digitalRead(RELAY_PUMP) == LOW ? "ON" : "OFF"), true);
  client.publish("smartfarm/relay/zone1/status", (digitalRead(RELAY_ZONE1) == LOW ? "ON" : "OFF"), true);
  client.publish("smartfarm/relay/lighthome/status", (digitalRead(RELAY_LIGHT_HOME) == LOW ? "ON" : "OFF"), true);
  client.publish("smartfarm/relay/lightsala/status", (digitalRead(RELAY_LIGHT_SALA) == LOW ? "ON" : "OFF"), true);
}

void publishSettings() {
  if (!client.connected()) return;
  client.publish("smartfarm/mode/status", (currentMode == AUTO ? "AUTO" : "MANUAL"), true);
  auto pubSched = [&](RelaySchedule& s, const char* name) {
    StaticJsonDocument<128> doc;
    doc["enabled"] = s.enabled;
    char onT[6], offT[6];
    sprintf(onT, "%02d:%02d", s.onHour, s.onMinute);
    sprintf(offT, "%02d:%02d", s.offHour, s.offMinute);
    doc["on"] = onT;
    doc["off"] = offT;
    char buffer[128];
    serializeJson(doc, buffer);
    String t = "smartfarm/schedule/"; t += name; t += "/status";
    client.publish(t.c_str(), buffer, true);
  };
  pubSched(pumpSchedule, "pump");
  pubSched(zone1Schedule, "zone1");
  pubSched(lightHomeSchedule, "lighthome");
  pubSched(lightSalaSchedule, "lightsala");
}

void saveConfig() {
  StaticJsonDocument<512> doc;
  doc["mode"] = (currentMode == AUTO ? "AUTO" : "MANUAL");
  auto addSched = [&](RelaySchedule& s, const char* key) {
    JsonObject obj = doc.createNestedObject(key);
    obj["en"] = s.enabled;
    obj["onH"] = s.onHour; obj["onM"] = s.onMinute;
    obj["offH"] = s.offHour; obj["offM"] = s.offMinute;
  };
  addSched(pumpSchedule, "p");
  addSched(zone1Schedule, "z");
  addSched(lightHomeSchedule, "h");
  addSched(lightSalaSchedule, "s");

  File f = LittleFS.open("/config.json", "w");
  if (f) { serializeJson(doc, f); f.close(); }
}

void loadConfig() {
  if (!LittleFS.exists("/config.json")) return;
  File f = LittleFS.open("/config.json", "r");
  if (!f) return;
  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, f) == DeserializationError::Ok) {
    currentMode = (doc["mode"] == "AUTO" ? AUTO : MANUAL);
    auto getSched = [&](RelaySchedule& s, const char* key) {
      if (doc.containsKey(key)) {
        s.enabled = doc[key]["en"];
        s.onHour = doc[key]["onH"]; s.onMinute = doc[key]["onM"];
        s.offHour = doc[key]["offH"]; s.offMinute = doc[key]["offM"];
      }
    };
    getSched(pumpSchedule, "p"); getSched(zone1Schedule, "z");
    getSched(lightHomeSchedule, "h"); getSched(lightSalaSchedule, "s");
  }
  f.close();
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  String topicStr = String(topic);

  Serial.println("MQTT Message: " + topicStr + " -> " + message);

  if (topicStr.startsWith("smartfarm/relay/")) {
    String relayName = topicStr.substring(16, topicStr.lastIndexOf("/"));
    int pin = -1;
    if (relayName == "pump") pin = RELAY_PUMP;
    else if (relayName == "zone1") pin = RELAY_ZONE1;
    else if (relayName == "lighthome") pin = RELAY_LIGHT_HOME;
    else if (relayName == "lightsala") pin = RELAY_LIGHT_SALA;

    if (pin != -1) {
      digitalWrite(pin, (message == "ON" ? LOW : HIGH));
      publishRelayStatus();
    }
  }
  else if (topicStr == "smartfarm/mode/set") {
    currentMode = (message == "AUTO" ? AUTO : MANUAL);
    publishSettings();
    saveConfig();
  }
  else if (topicStr.startsWith("smartfarm/schedule/")) {
    String relayName = topicStr.substring(19, topicStr.lastIndexOf("/"));
    RelaySchedule* sched = nullptr;
    if (relayName == "pump") sched = &pumpSchedule;
    else if (relayName == "zone1") sched = &zone1Schedule;
    else if (relayName == "lighthome") sched = &lightHomeSchedule;
    else if (relayName == "lightsala") sched = &lightSalaSchedule;

    if (sched) {
      if (message == "DELETE") {
        sched->enabled = false;
      } else {
        StaticJsonDocument<256> doc;
        if (deserializeJson(doc, message) == DeserializationError::Ok) {
          sched->enabled = doc["enabled"] | false;
          sscanf(doc["on"].as<const char*>(), "%d:%d", &sched->onHour, &sched->onMinute);
          sscanf(doc["off"].as<const char*>(), "%d:%d", &sched->offHour, &sched->offMinute);
        }
      }
      saveConfig();
      publishSettings();
    }
  }
}

void reconnect_mqtt() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  static unsigned long lastRetry = 0;
  if (millis() - lastRetry < 5000) return; // ลองใหม่ทุก 5 วินาทีแบบไม่ค้าง (Non-blocking)
  lastRetry = millis();

  Serial.print("Attempting MQTT connection... ");
  
  // *** Memory Optimization for ESP8266 ***
  espClient.setInsecure();
  espClient.setBufferSizes(512, 512); // ลดขนาด Buffer เพื่อประหยัด RAM
  
  if (client.connect(mqtt_client_id, mqtt_user, mqtt_pass, "smartfarm/status/online", 0, true, "false")) {
    Serial.println("CONNECTED!");
    client.publish("smartfarm/status/online", "true", true);
    client.subscribe("smartfarm/relay/+/set");
    client.subscribe("smartfarm/mode/set");
    client.subscribe("smartfarm/schedule/+/set");
    publishSettings();
    publishRelayStatus();
  } else {
    Serial.print("FAILED, rc=");
    Serial.println(client.state());
  }
}

void handleScheduledTasks() {
  if (currentMode != AUTO) return;
  DateTime now = getValidatedDateTime();
  if (now.year() < 2020) return; // Don't run schedule with invalid time
  int h = now.hour();
  int m = now.minute();
  static int lastM = -1;
  if (m == lastM) return; // ทำงานแค่ครั้งเดียวต่อนาที
  lastM = m;

  auto checkSched = [&](RelaySchedule& s, int pin) {
    if (!s.enabled) return;
    if (h == s.onHour && m == s.onMinute) digitalWrite(pin, LOW);
    else if (h == s.offHour && m == s.offMinute) digitalWrite(pin, HIGH);
  };
  checkSched(pumpSchedule, RELAY_PUMP);
  checkSched(zone1Schedule, RELAY_ZONE1);
  checkSched(lightHomeSchedule, RELAY_LIGHT_HOME);
  checkSched(lightSalaSchedule, RELAY_LIGHT_SALA);
  publishRelayStatus();
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== SMART FARM STARTING ===");
  
  if (!LittleFS.begin()) Serial.println("LittleFS Error");
  loadConfig();

  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_ZONE1, OUTPUT);
  pinMode(RELAY_LIGHT_HOME, OUTPUT);
  pinMode(RELAY_LIGHT_SALA, OUTPUT);
  digitalWrite(RELAY_PUMP, HIGH);
  digitalWrite(RELAY_ZONE1, HIGH);
  digitalWrite(RELAY_LIGHT_HOME, HIGH);
  digitalWrite(RELAY_LIGHT_SALA, HIGH);

  dht.begin();
  Wire.begin(D2, D1);
  if (!rtc.begin()) {
    Serial.println("RTC Not Found or failed to start.");
    rtcInitialized = false;
  } else {
    Serial.println("RTC Found and started.");
    rtcInitialized = true;
    // Check if RTC time is valid, if not, force sync on first loop
    if (rtc.now().year() < 2020) {
      Serial.println("RTC time is invalid, forcing immediate NTP sync.");
      lastRTCsync = 0; // Force immediate sync
    }
  }

  WiFiManager wm;
  // wm.resetSettings(); // ปลดคอมเมนต์หากต้องการล้างค่า WiFi เดิม
  wm.autoConnect("SmartFarm_Setup");

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setBufferSize(512);
  
  timeClient.begin();
  ArduinoOTA.setHostname("SmartFarm-Uytr");
  ArduinoOTA.begin();
  
  server.on("/", []() { server.send(200, "text/plain", "Smart Farm OK"); });
  server.begin();
  
  Serial.println("System Ready. Free Heap: " + String(ESP.getFreeHeap()));
}

void loop() {
  if (!client.connected()) {
    reconnect_mqtt();
  } else {
    client.loop();
  }
  
  ArduinoOTA.handle();
  server.handleClient();
  
  unsigned long now = millis();
  
  // ส่งเวลาและสถานะ
  if (now - lastStatusUpdate > statusInterval) {
    lastStatusUpdate = now;
    if (client.connected()) {
      DateTime currentTime = getValidatedDateTime();
      if (currentTime.year() > 2020) { // Only publish if time is valid
        char buf[32];
        sprintf(buf, "%04d-%02d-%02d %02d:%02d:%02d", currentTime.year(), currentTime.month(), currentTime.day(), currentTime.hour(), currentTime.minute(), currentTime.second());
        client.publish("smartfarm/time", buf);
      } else {
        Serial.println("Warning: Invalid time, not publishing.");
      }
    }
  }

  // อ่านเซ็นเซอร์
  if (now - lastSensorRead > sensorInterval) {
    lastSensorRead = now;
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h) && !isnan(t) && client.connected()) {
      StaticJsonDocument<128> doc;
      doc["temperature"] = t; doc["humidity"] = h;
      char buffer[128]; serializeJson(doc, buffer);
      client.publish("smartfarm/sensor/dht11", buffer);
    }
  }

  // ซิงค์เวลา
  if (now - lastRTCsync > rtcSyncInterval || lastRTCsync == 0) {
    if (WiFi.status() == WL_CONNECTED && timeClient.update()) {
      // Sync both date and time from NTP to RTC using Epoch Time
      DateTime ntpTime(timeClient.getEpochTime());
      if (ntpTime.year() > 2020) {
        rtc.adjust(ntpTime);
        lastRTCsync = now;
        Serial.println("RTC Synced from NTP: " + timeClient.getFormattedTime());
        rtcInitialized = true; // Confirm RTC is now holding a valid time
      } else {
        Serial.println("NTP time is invalid, not syncing RTC.");
      }
    }
  }

  handleScheduledTasks();
}
