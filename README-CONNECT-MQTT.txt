SMART FARM - MQTT CONNECTED (PRODUCTION MODE)

MQTT Broker:
  Host: 650188a0ee2b4367b7c131fb385590a9.s1.eu.hivemq.cloud
  ESP8266 SSL port: 8883
  Dashboard WebSocket Secure: wss://650188a0ee2b4367b7c131fb385590a9.s1.eu.hivemq.cloud:8884/mqtt

Authentication:
  Username: smartfarm
  Password: Kla12345

IMPORTANT:
This is a private authenticated broker. Data is secured via SSL/TLS.

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
