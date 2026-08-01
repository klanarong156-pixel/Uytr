document.addEventListener("DOMContentLoaded", () => {
    // ============================================================
    // SMART FARM MQTT CONFIG
    // IMPORTANT:
    // GitHub Pages is HTTPS, so the browser needs MQTT over WSS.
    // Example: wss://YOUR-MQTT-BROKER:8084/mqtt
    // The ESP8266 can use normal MQTT TCP (usually port 1883).
    // ============================================================
    const MQTT_CONFIG = {
        url: "wss://650188a0ee2b4367b7c131fb385590a9.s1.eu.hivemq.cloud:8884/mqtt",
        username: "smartfarm",
        password: "Kla12345",
        clientId: "SmartFarmWeb-" + Math.random().toString(16).slice(2)
    };

    const TOPIC = {
        online: "smartfarm/status/online",
        sensor: "smartfarm/sensor/dht11",
        time: "smartfarm/time",
        modeSet: "smartfarm/mode/set",
        modeStatus: "smartfarm/mode/status",
        mqttStatus: "smartfarm/mqtt/status",

        pumpSet: "smartfarm/relay/pump/set",
        pumpStatus: "smartfarm/relay/pump/status",
        zone1Set: "smartfarm/relay/zone1/set",
        zone1Status: "smartfarm/relay/zone1/status",
        lightHomeSet: "smartfarm/relay/lighthome/set",
        lightHomeStatus: "smartfarm/relay/lighthome/status",
        lightSalaSet: "smartfarm/relay/lightsala/set",
        lightSalaStatus: "smartfarm/relay/lightsala/status",

        pumpScheduleSet: "smartfarm/schedule/pump/set",
        pumpScheduleStatus: "smartfarm/schedule/pump/status"
    };

    const $ = id => document.getElementById(id);

    const espStatusElement = $("espStatus");
    const temperatureElement = $("temperature");
    const humidityElement = $("humidity");
    const currentTimeElement = $("currentTime");
    const mqttStatusElement = $("mqttStatus");

    const pumpToggleBtn = $("pumpToggle");
    const zone1ToggleBtn = $("zone1Toggle");
    const lightHomeToggleBtn = $("lightHomeToggle");
    const lightSalaToggleBtn = $("lightSalaToggle");

    const manualModeBtn = $("manualModeBtn");
    const autoModeBtn = $("autoModeBtn");
    const currentModeElement = $("currentMode");

    const pumpScheduleEnable = $("pumpScheduleEnable");
    const pumpOnInput = $("pumpOnInput");
    const pumpOffInput = $("pumpOffInput");
    const saveSchedulesBtn = $("saveSchedulesBtn");

    let mqttClient = null;

    function setMqttStatus(text, connected = false) {
        mqttStatusElement.textContent = text;
        mqttStatusElement.style.color = connected ? "green" : "red";
    }

    function updateRelayButton(button, message) {
        if (!button) return;
        const state = String(message).trim().toUpperCase();
        button.textContent = state === "ON" ? "เปิด" : "ปิด";
        button.classList.toggle("active", state === "ON");
        button.dataset.state = state;
    }

    function updateUI(topic, message) {
        message = String(message);

        switch (topic) {
            case TOPIC.online:
                espStatusElement.textContent =
                    message.toLowerCase() === "true" ? "Online" : "Offline";
                espStatusElement.style.color =
                    message.toLowerCase() === "true" ? "green" : "red";
                break;

            case TOPIC.sensor:
                try {
                    const data = JSON.parse(message);
                    if (data.temperature !== undefined)
                        temperatureElement.textContent = data.temperature;
                    if (data.humidity !== undefined)
                        humidityElement.textContent = data.humidity;
                } catch (e) {
                    console.error("DHT11 JSON error:", e, message);
                }
                break;

            case TOPIC.time:
                currentTimeElement.textContent = message;
                break;

            case TOPIC.pumpStatus:
                updateRelayButton(pumpToggleBtn, message);
                break;

            case TOPIC.zone1Status:
                updateRelayButton(zone1ToggleBtn, message);
                break;

            case TOPIC.lightHomeStatus:
                updateRelayButton(lightHomeToggleBtn, message);
                break;

            case TOPIC.lightSalaStatus:
                updateRelayButton(lightSalaToggleBtn, message);
                break;

            case TOPIC.modeStatus:
                currentModeElement.textContent = message;
                break;

            case TOPIC.pumpScheduleStatus:
                try {
                    const schedule = JSON.parse(message);
                    pumpScheduleEnable.checked = !!schedule.enabled;
                    pumpOnInput.value = schedule.on || "";
                    pumpOffInput.value = schedule.off || "";
                } catch (e) {
                    console.error("Schedule JSON error:", e, message);
                }
                break;
        }
    }

    function publish(topic, message) {
        if (!mqttClient || !mqttClient.connected) {
            alert("ยังไม่ได้เชื่อมต่อ MQTT");
            return false;
        }
        mqttClient.publish(topic, String(message), { qos: 0, retain: false });
        return true;
    }

    function connectMQTT() {
        if (!window.mqtt) {
            setMqttStatus("ไม่พบ MQTT library");
            console.error("MQTT.js failed to load.");
            return;
        }

        if (!MQTT_CONFIG.url || MQTT_CONFIG.url.includes("YOUR_MQTT_BROKER")) {
            setMqttStatus("ยังไม่ได้ตั้งค่า Broker");
            console.warn("กรุณาแก้ MQTT_CONFIG.url ใน script.js");
            return;
        }

        setMqttStatus("กำลังเชื่อมต่อ...");

        const options = {
            clientId: MQTT_CONFIG.clientId,
            clean: true,
            connectTimeout: 10000,
            reconnectPeriod: 5000
        };

        if (MQTT_CONFIG.username) options.username = MQTT_CONFIG.username;
        if (MQTT_CONFIG.password) options.password = MQTT_CONFIG.password;

        mqttClient = mqtt.connect(MQTT_CONFIG.url, options);

        mqttClient.on("connect", () => {
            setMqttStatus("Connected", true);

            mqttClient.subscribe([
                TOPIC.online,
                TOPIC.sensor,
                TOPIC.time,
                TOPIC.pumpStatus,
                TOPIC.zone1Status,
                TOPIC.lightHomeStatus,
                TOPIC.lightSalaStatus,
                TOPIC.modeStatus,
                TOPIC.pumpScheduleStatus
            ], { qos: 0 });

            // Ask the ESP/broker for current state by subscribing to retained status.
            // ESP should publish retained status messages.
            publish(TOPIC.mqttStatus, "Connected");
        });

        mqttClient.on("message", (topic, payload) => {
            updateUI(topic, payload.toString());
        });

        mqttClient.on("reconnect", () => setMqttStatus("กำลังเชื่อมต่อใหม่..."));
        mqttClient.on("offline", () => setMqttStatus("Offline"));
        mqttClient.on("close", () => setMqttStatus("Disconnected"));
        mqttClient.on("error", err => {
            setMqttStatus("MQTT Error");
            console.error("MQTT:", err);
        });
    }

    function toggleRelay(button, topic) {
        const current = button.dataset.state === "ON" ? "ON" : "OFF";
        const next = current === "ON" ? "OFF" : "ON";
        publish(topic, next);
    }

    pumpToggleBtn.addEventListener("click", () =>
        toggleRelay(pumpToggleBtn, TOPIC.pumpSet)
    );

    zone1ToggleBtn.addEventListener("click", () =>
        toggleRelay(zone1ToggleBtn, TOPIC.zone1Set)
    );

    lightHomeToggleBtn.addEventListener("click", () =>
        toggleRelay(lightHomeToggleBtn, TOPIC.lightHomeSet)
    );

    lightSalaToggleBtn.addEventListener("click", () =>
        toggleRelay(lightSalaToggleBtn, TOPIC.lightSalaSet)
    );

    manualModeBtn.addEventListener("click", () =>
        publish(TOPIC.modeSet, "MANUAL")
    );

    autoModeBtn.addEventListener("click", () =>
        publish(TOPIC.modeSet, "AUTO")
    );

    saveSchedulesBtn.addEventListener("click", () => {
        const schedule = {
            enabled: pumpScheduleEnable.checked,
            on: pumpOnInput.value,
            off: pumpOffInput.value
        };

        if (publish(TOPIC.pumpScheduleSet, JSON.stringify(schedule))) {
            alert("ส่งการตั้งค่าไปยัง ESP8266 แล้ว");
        }
    });

    // Initial UI
    espStatusElement.textContent = "Offline";
    temperatureElement.textContent = "--";
    humidityElement.textContent = "--";
    currentTimeElement.textContent = "--:--:--";
    setMqttStatus("Disconnected");
    updateRelayButton(pumpToggleBtn, "OFF");
    updateRelayButton(zone1ToggleBtn, "OFF");
    updateRelayButton(lightHomeToggleBtn, "OFF");
    updateRelayButton(lightSalaToggleBtn, "OFF");
    currentModeElement.textContent = "MANUAL";

    connectMQTT();
});
