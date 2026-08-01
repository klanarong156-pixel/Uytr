#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <LittleFS.h>
#include <WiFiClientSecure.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Function Prototypes
void setup_wifi();
void reconnect_mqtt();
void callback(char* topic, byte* payload, unsigned int length);
void publishRelayStatus(int pin, const char* topic);
void publishSettings();
void saveConfig();
void loadConfig();
void publishSensorData();
void handleScheduledTasks();
bool parseTime(const String& value, int& hour, int& minute);

// MQTT Broker details
const char* mqtt_server = "650188a0ee2b4367b7c131fb385590a9.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "smartfarm";
const char* mqtt_pass = "Kla12345";
const char* mqtt_client_id = "ESP8266SmartFarm";

#define DHTPIN D2
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

#define RELAY_PUMP       D1
#define RELAY_ZONE1      D5
#define RELAY_LIGHT_HOME D6
#define RELAY_LIGHT_SALA D7

WiFiClientSecure espClient;
PubSubClient client(espClient);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000);

enum OperatingMode { MANUAL, AUTO };
OperatingMode currentMode = MANUAL;

struct RelaySchedule {
  bool enabled = false;
  int onHour = 0, onMinute = 0;
  int offHour = 0, offMinute = 0;
};

RelaySchedule pumpSchedule;

unsigned long lastSensorRead = 0;
unsigned long lastStatus = 0;
const unsigned long sensorInterval = 30000;
const unsigned long statusInterval = 10000;

void publishRelayStatus(int pin, const char* topic) {
  client.publish(topic, digitalRead(pin) == LOW ? "ON" : "OFF", true);
}

void publishSettings() {
  client.publish("smartfarm/mode/status",
                 currentMode == MANUAL ? "MANUAL" : "AUTO", true);

  StaticJsonDocument<200> doc;
  doc["enabled"] = pumpSchedule.enabled;

  char onTime[6], offTime[6];
  snprintf(onTime, sizeof(onTime), "%02d:%02d",
           pumpSchedule.onHour, pumpSchedule.onMinute);
  snprintf(offTime, sizeof(offTime), "%02d:%02d",
           pumpSchedule.offHour, pumpSchedule.offMinute);

  doc["on"] = onTime;
  doc["off"] = offTime;

  char buffer[200];
  serializeJson(doc, buffer);
  client.publish("smartfarm/schedule/pump/status", buffer, true);
}

bool parseTime(const String& value, int& hour, int& minute) {
  if (value.length() != 5 || value.charAt(2) != ':') return false;
  hour = value.substring(0, 2).toInt();
  minute = value.substring(3, 5).toInt();
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60;
}

void saveConfig() {
  StaticJsonDocument<512> doc;
  doc["mode"] = currentMode == MANUAL ? "MANUAL" : "AUTO";
  doc["pumpSchedule"]["enabled"] = pumpSchedule.enabled;
  doc["pumpSchedule"]["onHour"] = pumpSchedule.onHour;
  doc["pumpSchedule"]["onMinute"] = pumpSchedule.onMinute;
  doc["pumpSchedule"]["offHour"] = pumpSchedule.offHour;
  doc["pumpSchedule"]["offMinute"] = pumpSchedule.offMinute;

  File f = LittleFS.open("/config.json", "w");
  if (!f) return;
  serializeJson(doc, f);
  f.close();
}

void loadConfig() {
  File f = LittleFS.open("/config.json", "r");
  if (!f) {
    saveConfig();
    return;
  }

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, f)) {
    f.close();
    return;
  }
  f.close();

  String mode = doc["mode"] | "MANUAL";
  currentMode = mode == "AUTO" ? AUTO : MANUAL;

  pumpSchedule.enabled = doc["pumpSchedule"]["enabled"] | false;
  pumpSchedule.onHour = doc["pumpSchedule"]["onHour"] | 0;
  pumpSchedule.onMinute = doc["pumpSchedule"]["onMinute"] | 0;
  pumpSchedule.offHour = doc["pumpSchedule"]["offHour"] | 0;
  pumpSchedule.offMinute = doc["pumpSchedule"]["offMinute"] | 0;
}

void setup_wifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi IP: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];

  String t = String(topic);

  if (t == "smartfarm/relay/pump/set") {
    digitalWrite(RELAY_PUMP, message == "ON" ? LOW : HIGH);
    publishRelayStatus(RELAY_PUMP, "smartfarm/relay/pump/status");

  } else if (t == "smartfarm/relay/zone1/set") {
    digitalWrite(RELAY_ZONE1, message == "ON" ? LOW : HIGH);
    publishRelayStatus(RELAY_ZONE1, "smartfarm/relay/zone1/status");

  } else if (t == "smartfarm/relay/lighthome/set") {
    digitalWrite(RELAY_LIGHT_HOME, message == "ON" ? LOW : HIGH);
    publishRelayStatus(RELAY_LIGHT_HOME, "smartfarm/relay/lighthome/status");

  } else if (t == "smartfarm/relay/lightsala/set") {
    digitalWrite(RELAY_LIGHT_SALA, message == "ON" ? LOW : HIGH);
    publishRelayStatus(RELAY_LIGHT_SALA, "smartfarm/relay/lightsala/status");

  } else if (t == "smartfarm/mode/set") {
    if (message == "MANUAL") currentMode = MANUAL;
    if (message == "AUTO") currentMode = AUTO;
    saveConfig();
    publishSettings();

  } else if (t == "smartfarm/schedule/pump/set") {
    StaticJsonDocument<200> doc;
    if (!deserializeJson(doc, message)) {
      pumpSchedule.enabled = doc["enabled"] | false;
      parseTime(doc["on"] | "00:00",
                pumpSchedule.onHour, pumpSchedule.onMinute);
      parseTime(doc["off"] | "00:00",
                pumpSchedule.offHour, pumpSchedule.offMinute);
      saveConfig();
      publishSettings();
    }
  }
}

void reconnect_mqtt() {
  while (!client.connected()) {
    Serial.print("MQTT connecting... ");

    if (client.connect(mqtt_client_id, mqtt_user, mqtt_pass,
                       "smartfarm/status/online", 0, true, "false")) {
      Serial.println("OK");

      client.subscribe("smartfarm/relay/pump/set");
      client.subscribe("smartfarm/relay/zone1/set");
      client.subscribe("smartfarm/relay/lighthome/set");
      client.subscribe("smartfarm/relay/lightsala/set");
      client.subscribe("smartfarm/mode/set");
      client.subscribe("smartfarm/schedule/pump/set");

      client.publish("smartfarm/status/online", "true", true);
      publishSettings();

    } else {
      Serial.print("failed rc=");
      Serial.println(client.state());
      delay(5000);
    }
  }
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
  client.publish("smartfarm/sensor/dht11", buffer, true);
}

void handleScheduledTasks() {
  if (currentMode != AUTO || !pumpSchedule.enabled) return;

  int h = timeClient.getHours();
  int m = timeClient.getMinutes();

  if (h == pumpSchedule.onHour && m == pumpSchedule.onMinute) {
    digitalWrite(RELAY_PUMP, LOW);
  }

  if (h == pumpSchedule.offHour && m == pumpSchedule.offMinute) {
    digitalWrite(RELAY_PUMP, HIGH);
  }
}

void setup() {
  Serial.begin(115200);
  
  // Configure WiFiClientSecure for HiveMQ Cloud
  espClient.setInsecure();

  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_ZONE1, OUTPUT);
  pinMode(RELAY_LIGHT_HOME, OUTPUT);
  pinMode(RELAY_LIGHT_SALA, OUTPUT);

  // Active-low relay board: HIGH = OFF
  digitalWrite(RELAY_PUMP, HIGH);
  digitalWrite(RELAY_ZONE1, HIGH);
  digitalWrite(RELAY_LIGHT_HOME, HIGH);
  digitalWrite(RELAY_LIGHT_SALA, HIGH);

  dht.begin();

  if (!LittleFS.begin()) {
    Serial.println("LittleFS mount failed");
  } else {
    loadConfig();
  }

  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  timeClient.begin();
  timeClient.update();

  ArduinoOTA.setHostname("SmartFarm-ESP8266");
  ArduinoOTA.begin();

  Serial.println("Smart Farm ready");
}

void loop() {
  if (!client.connected()) reconnect_mqtt();
  client.loop();

  ArduinoOTA.handle();
  timeClient.update();

  unsigned long now = millis();

  if (now - lastSensorRead >= sensorInterval) {
    lastSensorRead = now;
    publishSensorData();
  }

  if (now - lastStatus >= statusInterval) {
    lastStatus = now;

    char timeStr[9];
    snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d",
             timeClient.getHours(),
             timeClient.getMinutes(),
             timeClient.getSeconds());

    client.publish("smartfarm/time", timeStr, true);

    publishRelayStatus(RELAY_PUMP, "smartfarm/relay/pump/status");
    publishRelayStatus(RELAY_ZONE1, "smartfarm/relay/zone1/status");
    publishRelayStatus(RELAY_LIGHT_HOME, "smartfarm/relay/lighthome/status");
    publishRelayStatus(RELAY_LIGHT_SALA, "smartfarm/relay/lightsala/status");
  }

  handleScheduledTasks();
}
