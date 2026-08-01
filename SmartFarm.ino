#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <FS.h>
#include <ESP8266WebServer.h>

#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

// Telegram Bot API endpoint
const char* telegramHost = "api.telegram.org";

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Broker details
const char* mqtt_server = "YOUR_MQTT_BROKER_IP";
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP8266SmartFarm";

// Telegram Bot details (replace with your bot token and chat ID)
#define BOT_TOKEN "YOUR_TELEGRAM_BOT_TOKEN"
#define CHAT_ID "YOUR_TELEGRAM_CHAT_ID"

// DHT11 sensor details
#define DHTPIN D2     // GPIO4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Relay pins (adjust as per your hardware)
#define RELAY_PUMP D1 // GPIO5
#define RELAY_ZONE1 D5 // GPIO14
#define RELAY_LIGHT_HOME D6 // GPIO12
#define RELAY_LIGHT_SALA D7 // GPIO13

WiFiClient espClient;
PubSubClient client(espClient);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000);
ESP8266WebServer server(80);





void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.mode(WiFi_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect_mqtt() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(mqtt_client_id)) {
      Serial.println("connected");
      // Subscribe to topics
      client.subscribe("smartfarm/relay/pump/set");
      client.subscribe("smartfarm/relay/zone1/set");
      client.subscribe("smartfarm/relay/lighthome/set");
      client.subscribe("smartfarm/relay/lightsala/set");
      client.publish("smartfarm/status/online", "true");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // Handle relay commands
  if (String(topic) == "smartfarm/relay/pump/set") {
    if (message == "ON") {
      digitalWrite(RELAY_PUMP, LOW);
      client.publish("smartfarm/relay/pump/status", "ON");
    } else if (message == "OFF") {
      digitalWrite(RELAY_PUMP, HIGH);
      client.publish("smartfarm/relay/pump/status", "OFF");
    }
  }
  // Add similar logic for other relays
}

void setup_ota() {
  ArduinoOTA.onStart([]() {
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) {
      type = "sketch";
    } else { // U_FS
      type = "filesystem";
    }
    // NOTE: if updating FS this would be the place to unmount FS using FS.end()
    Serial.println("Start updating " + type);
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("\nEnd");
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) {
      Serial.println("Auth Failed");
    } else if (error == OTA_BEGIN_ERROR) {
      Serial.println("Begin Failed");
    } else if (error == OTA_CONNECT_ERROR) {
      Serial.println("Connect Failed");
    } else if (error == OTA_RECEIVE_ERROR) {
      Serial.println("Receive Failed");
    } else if (error == OTA_END_ERROR) {
      Serial.println("End Failed");
    }
  });
  ArduinoOTA.begin();
  Serial.println("OTA Ready");
  Serial.print("IP address: ");
  Serial.println(ArduinoOTA.getHostname());
}

// Function to send Telegram message (requires a separate library or direct HTTP POST)
void sendTelegramMessage(String message) {
  WiFiClientSecure client_telegram;
  client_telegram.setInsecure(); // Use with caution, only for testing
  HTTPClient http;
  String telegramUrl = "https://api.telegram.org/bot" + String(BOT_TOKEN) + "/sendMessage?chat_id=" + String(CHAT_ID) + "&text=" + message;
  http.begin(client_telegram, telegramUrl);
  int httpCode = http.GET();
  if (httpCode > 0) {
    Serial.printf("[HTTP] GET... code: %d\n", httpCode);
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      Serial.println(payload);
    }
  } else {
    Serial.printf("[HTTP] GET... failed, error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
  // This part would typically use a library like UniversalTelegramBot or make direct HTTP requests.
  // For simplicity and to avoid adding another large library, we'll leave this as a placeholder.
  // Example using HTTPClient (needs #include <ESP8266HTTPClient.h>)
  /*
  WiFiClientSecure client_telegram;
  client_telegram.setInsecure(); // Use with caution, only for testing
  HTTPClient http;
  String telegramUrl = "https://api.telegram.org/bot" + String(BOT_TOKEN) + "/sendMessage?chat_id=" + String(CHAT_ID) + "&text=" + message;
  http.begin(client_telegram, telegramUrl);
  int httpCode = http.GET();
  if (httpCode > 0) {
    Serial.printf("[HTTP] GET... code: %d\n", httpCode);
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      Serial.println(payload);
    }
  } else {
    Serial.printf("[HTTP] GET... failed, error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
  */
  Serial.print("Telegram message: ");
  Serial.println(message);
}

// Placeholder for saving/loading configuration from LittleFS
void saveConfig() {
  // Implement saving relay schedules, mode, etc. to a JSON file in LittleFS
  Serial.println("Saving configuration...");
}

void loadConfig() {
  // Implement loading relay schedules, mode, etc. from a JSON file in LittleFS
  Serial.println("Loading configuration...");
}

// Placeholder for reading DHT11 and publishing to MQTT
void publishSensorData() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }

  StaticJsonDocument<200> doc;
  doc["temperature"] = t;
  doc["humidity"] = h;

  char jsonBuffer[200];
  serializeJson(doc, jsonBuffer);

  client.publish("smartfarm/sensor/dht11", jsonBuffer);
}

// Placeholder for handling scheduled tasks (Auto mode)
void handleScheduledTasks() {
  // This will contain the logic for checking current time against schedules
  // and activating/deactivating relays based on the Auto mode configuration.
}

// Placeholder for publishing relay status
void publishRelayStatus(int relayPin, const char* topic) {
  if (digitalRead(relayPin) == LOW) {
    client.publish(topic, "ON");
  } else {
    client.publish(topic, "OFF");
  }
}

// Add periodic tasks to loop
unsigned long lastMsg = 0;
unsigned long lastSensorRead = 0;
const long sensorInterval = 30000; // 30 seconds
const long statusInterval = 60000; // 1 minute

void loop() {
  if (!client.connected()) {
    reconnect_mqtt();
  }
  client.loop();
  ArduinoOTA.handle();
  timeClient.update();
  server.handleClient(); // Handle web server requests

  unsigned long now = millis();
  if (now - lastSensorRead > sensorInterval) {
    lastSensorRead = now;
    publishSensorData();
  }

  if (now - lastMsg > statusInterval) {
    lastMsg = now;
    // Publish current time
    char timeStr[50];
    sprintf(timeStr, "%02d:%02d:%02d", timeClient.getHours(), timeClient.getMinutes(), timeClient.getSeconds());
    client.publish("smartfarm/time", timeStr);

    // Publish relay statuses
    publishRelayStatus(RELAY_PUMP, "smartfarm/relay/pump/status");
    publishRelayStatus(RELAY_ZONE1, "smartfarm/relay/zone1/status");
    publishRelayStatus(RELAY_LIGHT_HOME, "smartfarm/relay/lighthome/status");
    publishRelayStatus(RELAY_LIGHT_SALA, "smartfarm/relay/lightsala/status");
  }

  handleScheduledTasks();
}

// Update callback to handle all relays
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // Handle relay commands
  if (String(topic) == "smartfarm/relay/pump/set") {
    if (message == "ON") {
      digitalWrite(RELAY_PUMP, LOW);
      client.publish("smartfarm/relay/pump/status", "ON");
      sendTelegramMessage("ปั๊มน้ำเปิด");
    } else if (message == "OFF") {
      digitalWrite(RELAY_PUMP, HIGH);
      client.publish("smartfarm/relay/pump/status", "OFF");
      sendTelegramMessage("ปั๊มน้ำปิด");
    }
  } else if (String(topic) == "smartfarm/relay/zone1/set") {
    if (message == "ON") {
      digitalWrite(RELAY_ZONE1, LOW);
      client.publish("smartfarm/relay/zone1/status", "ON");
    } else if (message == "OFF") {
      digitalWrite(RELAY_ZONE1, HIGH);
      client.publish("smartfarm/relay/zone1/status", "OFF");
    }
  } else if (String(topic) == "smartfarm/relay/lighthome/set") {
    if (message == "ON") {
      digitalWrite(RELAY_LIGHT_HOME, LOW);
      client.publish("smartfarm/relay/lighthome/status", "ON");
    } else if (message == "OFF") {
      digitalWrite(RELAY_LIGHT_HOME, HIGH);
      client.publish("smartfarm/relay/lighthome/status", "OFF");
    }
  } else if (String(topic) == "smartfarm/relay/lightsala/set") {
    if (message == "ON") {
      digitalWrite(RELAY_LIGHT_SALA, LOW);
      client.publish("smartfarm/relay/lightsala/status", "ON");
    } else if (message == "OFF") {
      digitalWrite(RELAY_LIGHT_SALA, HIGH);
      client.publish("smartfarm/relay/lightsala/status", "OFF");
    }
  } else if (String(topic) == "smartfarm/mode/set") {
    // Handle mode change (Manual/Auto)
    // This will require a global variable for mode and logic in handleScheduledTasks()
  }
}

// Update reconnect_mqtt to send offline status
void reconnect_mqtt() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(mqtt_client_id, "smartfarm/status/online", 0, true, "false")) { // Last Will and Testament
      Serial.println("connected");
      // Subscribe to topics
      client.subscribe("smartfarm/relay/pump/set");
      client.subscribe("smartfarm/relay/zone1/set");
      client.subscribe("smartfarm/relay/lighthome/set");
      client.subscribe("smartfarm/relay/lightsala/set");
      client.subscribe("smartfarm/mode/set");
      client.publish("smartfarm/status/online", "true", true);
      sendTelegramMessage("ESP Online");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// Add a global variable for current mode and relay schedules
enum OperatingMode { MANUAL, AUTO };
OperatingMode currentMode = MANUAL;

struct RelaySchedule {
  bool enabled;
  int onHour, onMinute;
  int offHour, offMinute;
};

RelaySchedule pumpSchedule;
RelaySchedule zone1Schedule;
RelaySchedule lightHomeSchedule;
RelaySchedule lightSalaSchedule;

// Function to parse time string (HH:MM)
bool parseTime(const String& timeStr, int& hour, int& minute) {
  if (timeStr.length() != 5 || timeStr.charAt(2) != ':') return false;
  hour = timeStr.substring(0, 2).toInt();
  minute = timeStr.substring(3, 5).toInt();
  return (hour >= 0 && hour < 24 && minute >= 0 && minute < 60);
}

// Update handleScheduledTasks
void handleScheduledTasks() {
  if (currentMode == AUTO) {
    int currentHour = timeClient.getHours();
    int currentMinute = timeClient.getMinutes();

    // Handle Pump schedule
    if (pumpSchedule.enabled) {
      if (currentHour == pumpSchedule.onHour && currentMinute == pumpSchedule.onMinute) {
        if (digitalRead(RELAY_PUMP) == HIGH) { // If currently OFF
          digitalWrite(RELAY_PUMP, LOW);
          client.publish("smartfarm/relay/pump/status", "ON");
          sendTelegramMessage("ปั๊มน้ำเปิด (Auto)");
        }
      } else if (currentHour == pumpSchedule.offHour && currentMinute == pumpSchedule.offMinute) {
        if (digitalRead(RELAY_PUMP) == LOW) { // If currently ON
          digitalWrite(RELAY_PUMP, HIGH);
          client.publish("smartfarm/relay/pump/status", "OFF");
          sendTelegramMessage("ปั๊มน้ำปิด (Auto)");
        }
      }
    }
    // Add similar logic for other relays
  }
}

// Update saveConfig and loadConfig to use ArduinoJson and LittleFS
void saveConfig() {
  StaticJsonDocument<1024> doc;
  doc["mode"] = (currentMode == MANUAL) ? "MANUAL" : "AUTO";

  doc["pumpSchedule"]["enabled"] = pumpSchedule.enabled;
  doc["pumpSchedule"]["onHour"] = pumpSchedule.onHour;
  doc["pumpSchedule"]["onMinute"] = pumpSchedule.onMinute;
  doc["pumpSchedule"]["offHour"] = pumpSchedule.offHour;
  doc["pumpSchedule"]["offMinute"] = pumpSchedule.offMinute;

  // Add other relay schedules

  File configFile = LittleFS.open("/config.json", "w");
  if (!configFile) {
    Serial.println("Failed to open config file for writing");
    return;
  }
  serializeJson(doc, configFile);
  configFile.close();
  Serial.println("Configuration saved.");
}

void loadConfig() {
  File configFile = LittleFS.open("/config.json", "r");
  if (!configFile) {
    Serial.println("Failed to open config file");
    saveConfig(); // Create default config if not found
    return;
  }

  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, configFile);
  if (error) {
    Serial.println(F("Failed to read file, using default configuration"));
    return;
  }

  String modeStr = doc["mode"].as<String>();
  currentMode = (modeStr == "MANUAL") ? MANUAL : AUTO;

  pumpSchedule.enabled = doc["pumpSchedule"]["enabled"] | false;
  pumpSchedule.onHour = doc["pumpSchedule"]["onHour"] | 0;
  pumpSchedule.onMinute = doc["pumpSchedule"]["onMinute"] | 0;
  pumpSchedule.offHour = doc["pumpSchedule"]["offHour"] | 0;
  pumpSchedule.offMinute = doc["pumpSchedule"]["offMinute"] | 0;

  // Load other relay schedules

  configFile.close();
  Serial.println("Configuration loaded.");
}

// Update setup() to load config
void setup() {
  Serial.begin(115200);
  Serial.println("\nBooting Smart Farm...");

  if (!LittleFS.begin()) {
    Serial.println("An Error has occurred while mounting LittleFS");
    return;
  }
  loadConfig(); // Load configuration at startup

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  setup_ota();
  dht.begin();

  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_ZONE1, OUTPUT);
  pinMode(RELAY_LIGHT_HOME, OUTPUT);
  pinMode(RELAY_LIGHT_SALA, OUTPUT);
  // Set initial relay states based on loaded config or default (OFF)
  digitalWrite(RELAY_PUMP, HIGH);
  digitalWrite(RELAY_ZONE1, HIGH);
  digitalWrite(RELAY_LIGHT_HOME, HIGH);
  digitalWrite(RELAY_LIGHT_SALA, HIGH);

  timeClient.begin();

  // Setup Web Server
  server.on("/", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/html", LittleFS.open("/index.html", "r").readString());
  });
  server.on("/style.css", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/css", LittleFS.open("/style.css", "r").readString());
  });
  server.on("/script.js", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/javascript", LittleFS.open("/script.js", "r").readString());
  });
  server.on("/logo.png", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    File logoFile = LittleFS.open("/logo.png", "r");
    if (logoFile) {
      server.streamFile(logoFile, "image/png");
      logoFile.close();
    } else {
      server.send(404, "text/plain", "File Not Found");
    }
  });
  server.begin();

  Serial.println("Smart Farm Booted.");
}

// Add MQTT topics for setting schedules and mode
// In callback function:
// ...
  } else if (String(topic) == "smartfarm/mode/set") {
    if (message == "MANUAL") {
      currentMode = MANUAL;
      client.publish("smartfarm/mode/status", "MANUAL");
      saveConfig();
    } else if (message == "AUTO") {
      currentMode = AUTO;
      client.publish("smartfarm/mode/status", "AUTO");
      saveConfig();
    }
  } else if (String(topic) == "smartfarm/schedule/pump/set") {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (!error) {
      pumpSchedule.enabled = doc["enabled"] | false;
      parseTime(doc["on"].as<String>(), pumpSchedule.onHour, pumpSchedule.onMinute);
      parseTime(doc["off"].as<String>(), pumpSchedule.offHour, pumpSchedule.offMinute);
      saveConfig();
      client.publish("smartfarm/schedule/pump/status", message.c_str());
    }
  }
// Add similar logic for other relay schedules

// Add a function to publish all current settings (mode, schedules) to MQTT
void publishSettings() {
  client.publish("smartfarm/mode/status", (currentMode == MANUAL) ? "MANUAL" : "AUTO");

  StaticJsonDocument<200> doc;
  doc["enabled"] = pumpSchedule.enabled;
  char onTime[6]; sprintf(onTime, "%02d:%02d", pumpSchedule.onHour, pumpSchedule.onMinute);
  char offTime[6]; sprintf(offTime, "%02d:%02d", pumpSchedule.offHour, pumpSchedule.offMinute);
  doc["on"] = onTime;
  doc["off"] = offTime;
  char jsonBuffer[200];
  serializeJson(doc, jsonBuffer);
  client.publish("smartfarm/schedule/pump/status", jsonBuffer);

  // Publish other relay schedules
}

// Call publishSettings() after MQTT connection in reconnect_mqtt()
// ...
      client.publish("smartfarm/status/online", "true", true);
      sendTelegramMessage("ESP Online");
      publishSettings(); // Publish current settings after connecting
// ...

// Add a function to send Telegram message for ESP Offline
void sendOfflineTelegram() {
  sendTelegramMessage("ESP Offline");
}

// Modify reconnect_mqtt to send offline message via LWT
// This is already done: client.connect(mqtt_client_id, "smartfarm/status/online", 0, true, "false")
// The MQTT broker will send "false" when ESP goes offline.
// However, for explicit Telegram notification, we need to handle it differently.
// The easiest way is to use a separate service that monitors MQTT last will messages and sends Telegram.
// For this firmware, we will only send 
