// Configuration for Smart Farm Dashboard

const MQTT_CONFIG = {
    url: "wss://650188a0ee2b4367b7c131fb385590a9.s1.eu.hivemq.cloud:8884/mqtt",
    username: "smartfarm",
    password: "Kla12345",
    clientId: "SmartFarmWeb-" + Math.random().toString(16).slice(2),
    topics: {
        relaySet: (relay) => `smartfarm/relay/${relay}/set`,
        relayStatus: (relay) => `smartfarm/relay/${relay}/status`,
        sensor: (type) => `smartfarm/sensor/${type}`,
        modeSet: "smartfarm/mode/set",
        modeStatus: "smartfarm/mode/status",
        scheduleSet: (relay) => `smartfarm/schedule/${relay}/set`,
        scheduleStatus: (relay) => `smartfarm/schedule/${relay}/status`,
        online: "smartfarm/status/online"
    }
};

const RELAYS = ["pump", "zone1", "lighthome", "lightsala"];

const RELAY_NAMES = {
    pump: "ปั๊มน้ำ",
    zone1: "โซน 1",
    lighthome: "ไฟบ้าน",
    lightsala: "ไฟศาลา"
};

const APP_STATE = {
    mqttConnected: false,
    espOnline: false,
    mode: 'manual', // 'manual' or 'auto'
    relays: {
        pump: false,
        zone1: false,
        lighthome: false,
        lightsala: false
    },
    sensors: {
        temperature: 0,
        humidity: 0
    }
};
