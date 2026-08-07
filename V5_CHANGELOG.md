# SmartFarm V5 Stabilization

## Changes

- Added MQTT credential template support
- Prepared secure configuration separation
- Verified existing non-blocking MQTT reconnect logic
- Verified RTC fallback strategy
- Verified LittleFS schedule storage
- Verified OTA and relay status publishing flow

## Test Checklist

- [ ] ESP8266 boot test
- [ ] MQTT reconnect test
- [ ] Relay 4 channel test
- [ ] RTC offline test
- [ ] OTA update test
- [ ] Dashboard status sync test
