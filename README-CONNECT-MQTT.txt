SMART FARM - MQTT CONNECTED (TEST MODE)

MQTT Broker:
  Host: broker.hivemq.com
  ESP8266 TCP port: 1883
  Dashboard WebSocket Secure: wss://broker.hivemq.com:8884/mqtt

No username/password is used for this public test broker.

IMPORTANT:
This is a PUBLIC MQTT broker. Do NOT use it for private/security-sensitive
data or a production irrigation system. Use a private authenticated broker
(HiveMQ Cloud or your own broker) for production.

Dashboard topics:
  smartfarm/status/online
  smartfarm/sensor/dht11
  smartfarm/time
  smartfarm/relay/pump/set
  smartfarm/relay/pump/status
  smartfarm/relay/zone1/set
  smartfarm/relay/zone1/status
  smartfarm/relay/lighthome/set
  smartfarm/relay/lighthome/status
  smartfarm/relay/lightsala/set
  smartfarm/relay/lightsala/status
  smartfarm/mode/set
  smartfarm/mode/status
  smartfarm/schedule/pump/set
  smartfarm/schedule/pump/status
