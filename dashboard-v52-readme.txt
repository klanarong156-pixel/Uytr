SmartFarm V5.2 Dashboard Patch
================================
Production MQTT:
WSS HiveMQ Cloud :8884/mqtt
Firmware MQTT TLS: :8883

Dashboard supports:
- Pump manual quick control
- Zone 1 / Home Light / Sala Light controls
- Manual / Auto mode
- Schedule: Pump, Zone 1, Home Light, Sala Light
- Schedule status synchronization
- MQTT relay status synchronization

Install:
1. Backup your current dashboard files.
2. Replace config.js and mqtt-handler.js with these files.
3. Keep your existing HTML/CSS and other JS files.
4. Hard refresh the browser (Ctrl+F5).
5. Test MQTT connection before switching Auto mode.

Security:
The MQTT password is embedded because this is the supplied browser dashboard configuration.
After testing, rotate the HiveMQ password if this credential has been exposed.
