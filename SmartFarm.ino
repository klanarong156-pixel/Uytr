#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <LittleFS.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <RTClib.h>

// ==================== WiFi & MQTT Config ====================
const char* ssid = "Klarong-2.5G";
const char* password = "kla56435";
const char* mqtt_server = "650188a0ee2b4367b7c131fb385590a9.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "smartfarm";
const char* mqtt_pass = "Kla12345";
const char* mqtt_client_id = "ESP8266SmartFarm_Uytr";

// ==================== Telegram Config ====================
#define BOT_TOKEN "8667185180:AAEaPMQFRUW7AhqgSFdMgMdzzZTAY4OIbjw"
#define CHAT_ID "8698930095"

// ==================== Hardware Pins ====================
#define DHTPIN D2
#define DHTTYPE DHT11
#define RELAY_PUMP D1
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
const long sensorInterval = 30000;
const long statusInterval = 10000; // More frequent status updates for "Realtime" feel
const long rtcSyncInterval = 3600000; // Sync RTC with NTP every hour

// ==================== Function Prototypes ====================
void setup_wifi();
void reconnect_mqtt();
void callback(char* topic, byte* payload, unsigned int length);
void setup_ota();
void sendTelegramMessage(String message);
void saveConfig();
void loadConfig();
void publishSensorData();
void publishRelayStatus();
void publishSettings();
void handleScheduledTasks();
bool parseTime(const String& timeStr, int& hour, int& minute);

// ==================== Core Functions ====================

void setup() {
  Serial.begin(115200);
  Serial.println(F("\n--- Smart Farm Uytr Booting ---"));

  // Initialize LittleFS
  if (!LittleFS.begin()) {
    Serial.println("LittleFS Mount Failed");
  } else {
    loadConfig();
  }

  // Initialize Hardware
  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_ZONE1, OUTPUT);
  pinMode(RELAY_LIGHT_HOME, OUTPUT);
  pinMode(RELAY_LIGHT_SALA, OUTPUT);
  
  // Default OFF (Relays are usually Active LOW)
  digitalWrite(RELAY_PUMP, HIGH);
  digitalWrite(RELAY_ZONE1, HIGH);
  digitalWrite(RELAY_LIGHT_HOME, HIGH);
  digitalWrite(RELAY_LIGHT_SALA, HIGH);

  dht.begin();
  Wire.begin(D2, D1); // I2C for RTC (Using D2, D1 as in V9)
  
  if (!rtc.begin()) {
    Serial.println("Couldn't find RTC");
  }

  setup_wifi();
  
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  
  timeClient.begin();
  setup_ota();

  // Web Server Routes
  server.on("/", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    File file = LittleFS.open("/index.html", "r");
    if (file) {
      server.streamFile(file, "text/html");
      file.close();
    }
  });
  server.on("/style.css", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    File file = LittleFS.open("/style.css", "r");
    if (file) {
      server.streamFile(file, "text/css");
      file.close();
    }
  });
  server.on("/script.js", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    File file = LittleFS.open("/script.js", "r");
    if (file) {
      server.streamFile(file, "application/javascript");
      file.close();
    }
  });
  server.begin();

  Serial.println("System Ready.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setup_wifi();
  }

  if (!client.connected()) {
    reconnect_mqtt();
  }
  client.loop();
  ArduinoOTA.handle();
  server.handleClient();

  unsigned long now = millis();

  // Periodic Sensor Reading
  if (now - lastSensorRead > sensorInterval) {
    lastSensorRead = now;
    publishSensorData();
  }

  // Periodic Status Update (Realtime time and relay status)
  if (now - lastStatusUpdate > statusInterval) {
    lastStatusUpdate = now;
    DateTime rtcNow = rtc.now();
    char timeStr[20];
    sprintf(timeStr, "%02d:%02d:%02d", rtcNow.hour(), rtcNow.minute(), rtcNow.second());
    client.publish("smartfarm/time", timeStr);
    publishRelayStatus();
  }

  // Periodic RTC Sync with NTP
  if (now - lastRTCsync > rtcSyncInterval || lastRTCsync == 0) {
    if (timeClient.update()) {
      DateTime ntpTime(2026, 1, 1, timeClient.getHours(), timeClient.getMinutes(), timeClient.getSeconds()); // Dummy date, we care about time
      rtc.adjust(ntpTime);
      lastRTCsync = now;
      Serial.println("RTC Synced with NTP");
    }
  }

  handleScheduledTasks();
}

// ==================== MQTT & Communication ====================

void setup_wifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int counter = 0;
  while (WiFi.status() != WL_CONNECTED && counter < 20) {
    delay(500);
    Serial.print(".");
    counter++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected. IP: " + WiFi.localIP().toString());
  }
}

void reconnect_mqtt() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Last Will and Testament for Online status
    if (client.connect(mqtt_client_id, mqtt_user, mqtt_pass, "smartfarm/status/online", 0, true, "false")) {
      Serial.println("connected");
      client.publish("smartfarm/status/online", "true", true);
      
      // Subscribe to all control topics
      client.subscribe("smartfarm/relay/+/set");
      client.subscribe("smartfarm/mode/set");
      client.subscribe("smartfarm/schedule/+/set");
      
      publishSettings();
      sendTelegramMessage("Smart Farm Online 📡");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  String topicStr = String(topic);

  Serial.println("Message arrived [" + topicStr + "] " + message);

  // Relay Control
  if (topicStr.startsWith("smartfarm/relay/")) {
    String relayName = topicStr.substring(16, topicStr.lastIndexOf("/"));
    int pin = -1;
    String statusTopic = "";

    if (relayName == "pump") { pin = RELAY_PUMP; statusTopic = "smartfarm/relay/pump/status"; }
    else if (relayName == "zone1") { pin = RELAY_ZONE1; statusTopic = "smartfarm/relay/zone1/status"; }
    else if (relayName == "lighthome") { pin = RELAY_LIGHT_HOME; statusTopic = "smartfarm/relay/lighthome/status"; }
    else if (relayName == "lightsala") { pin = RELAY_LIGHT_SALA; statusTopic = "smartfarm/relay/lightsala/status"; }

    if (pin != -1) {
      if (message == "ON") {
        digitalWrite(pin, LOW);
        client.publish(statusTopic.c_str(), "ON", true);
      } else if (message == "OFF") {
        digitalWrite(pin, HIGH);
        client.publish(statusTopic.c_str(), "OFF", true);
      }
    }
  }
  // Mode Control
  else if (topicStr == "smartfarm/mode/set") {
    if (message == "AUTO") currentMode = AUTO;
    else currentMode = MANUAL;
    client.publish("smartfarm/mode/status", (currentMode == AUTO ? "AUTO" : "MANUAL"), true);
    saveConfig();
  }
  // Schedule Control
  else if (topicStr.startsWith("smartfarm/schedule/")) {
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (!error) {
      String relayName = topicStr.substring(19, topicStr.lastIndexOf("/"));
      RelaySchedule* sched = nullptr;
      if (relayName == "pump") sched = &pumpSchedule;
      else if (relayName == "zone1") sched = &zone1Schedule;
      else if (relayName == "lighthome") sched = &lightHomeSchedule;
      else if (relayName == "lightsala") sched = &lightSalaSchedule;

      if (sched) {
        sched->enabled = doc["enabled"] | false;
        parseTime(doc["on"].as<String>(), sched->onHour, sched->onMinute);
        parseTime(doc["off"].as<String>(), sched->offHour, sched->offMinute);
        saveConfig();
        // Echo back status
        String statusTopic = "smartfarm/schedule/" + relayName + "/status";
        client.publish(statusTopic.c_str(), message.c_str(), true);
      }
    }
  }
}

// ==================== Logic & Helpers ====================

void handleScheduledTasks() {
  if (currentMode != AUTO) return;

  DateTime now = rtc.now();
  int h = now.hour();
  int m = now.minute();

  auto checkSched = [&](RelaySchedule& s, int pin, const char* name) {
    if (!s.enabled) return;
    if (h == s.onHour && m == s.onMinute) {
      if (digitalRead(pin) == HIGH) {
        digitalWrite(pin, LOW);
        String t = "smartfarm/relay/"; t += name; t += "/status";
        client.publish(t.c_str(), "ON", true);
      }
    } else if (h == s.offHour && m == s.offMinute) {
      if (digitalRead(pin) == LOW) {
        digitalWrite(pin, HIGH);
        String t = "smartfarm/relay/"; t += name; t += "/status";
        client.publish(t.c_str(), "OFF", true);
      }
    }
  };

  checkSched(pumpSchedule, RELAY_PUMP, "pump");
  checkSched(zone1Schedule, RELAY_ZONE1, "zone1");
  checkSched(lightHomeSchedule, RELAY_LIGHT_HOME, "lighthome");
  checkSched(lightSalaSchedule, RELAY_LIGHT_SALA, "lightsala");
}

void publishSensorData() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) return;

  StaticJsonDocument<128> doc;
  doc["temperature"] = t;
  doc["humidity"] = h;
  char buffer[128];
  serializeJson(doc, buffer);
  client.publish("smartfarm/sensor/dht11", buffer);
}

void publishRelayStatus() {
  client.publish("smartfarm/relay/pump/status", (digitalRead(RELAY_PUMP) == LOW ? "ON" : "OFF"), true);
  client.publish("smartfarm/relay/zone1/status", (digitalRead(RELAY_ZONE1) == LOW ? "ON" : "OFF"), true);
  client.publish("smartfarm/relay/lighthome/status", (digitalRead(RELAY_LIGHT_HOME) == LOW ? "ON" : "OFF"), true);
  client.publish("smartfarm/relay/lightsala/status", (digitalRead(RELAY_LIGHT_SALA) == LOW ? "ON" : "OFF"), true);
}

void publishSettings() {
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
  StaticJsonDocument<1024> doc;
  doc["mode"] = (currentMode == AUTO ? "AUTO" : "MANUAL");
  
  auto addSched = [&](RelaySchedule& s, const char* key) {
    JsonObject obj = doc.createNestedObject(key);
    obj["enabled"] = s.enabled;
    obj["onH"] = s.onHour;
    obj["onM"] = s.onMinute;
    obj["offH"] = s.offHour;
    obj["offM"] = s.offMinute;
  };

  addSched(pumpSchedule, "pump");
  addSched(zone1Schedule, "zone1");
  addSched(lightHomeSchedule, "lighthome");
  addSched(lightSalaSchedule, "sala");

  File f = LittleFS.open("/config.json", "w");
  if (f) {
    serializeJson(doc, f);
    f.close();
  }
}

void loadConfig() {
  File f = LittleFS.open("/config.json", "r");
  if (!f) return;
  StaticJsonDocument<1024> doc;
  if (deserializeJson(doc, f) == DeserializationError::Ok) {
    currentMode = (doc["mode"] == "AUTO" ? AUTO : MANUAL);
    
    auto getSched = [&](RelaySchedule& s, const char* key) {
      if (doc.containsKey(key)) {
        s.enabled = doc[key]["enabled"];
        s.onHour = doc[key]["onH"];
        s.onMinute = doc[key]["onM"];
        s.offHour = doc[key]["offH"];
        s.offMinute = doc[key]["offM"];
      }
    };

    getSched(pumpSchedule, "pump");
    getSched(zone1Schedule, "zone1");
    getSched(lightHomeSchedule, "lighthome");
    getSched(lightSalaSchedule, "sala");
  }
  f.close();
}

void sendTelegramMessage(String message) {
  WiFiClientSecure tgClient;
  tgClient.setInsecure();
  HTTPClient http;
  String url = "https://api.telegram.org/bot" + String(BOT_TOKEN) + "/sendMessage?chat_id=" + String(CHAT_ID) + "&text=" + message;
  if (http.begin(tgClient, url)) {
    http.GET();
    http.end();
  }
}

bool parseTime(const String& timeStr, int& hour, int& minute) {
  if (timeStr.length() < 5) return false;
  int colonPos = timeStr.indexOf(':');
  if (colonPos == -1) return false;
  hour = timeStr.substring(0, colonPos).toInt();
  minute = timeStr.substring(colonPos + 1).toInt();
  return true;
}

void setup_ota() {
  ArduinoOTA.setHostname("SmartFarm-Uytr");
  ArduinoOTA.begin();
}
