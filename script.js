document.addEventListener("DOMContentLoaded", () => {
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
        relayStatus: "smartfarm/relay/+/status",
        relaySet: "smartfarm/relay/+/set",
        scheduleStatus: "smartfarm/schedule/+/status",
        scheduleSet: "smartfarm/schedule/+/set"
    };

    const $ = id => document.getElementById(id);
    let mqttClient = null;

    // UI Elements
    const currentTimeElement = $("currentTime");
    const mqttStatusCircle = $("mqttStatusCircle");
    const mqttStatusText = $("mqttStatus");

    function setMqttStatus(text, status) {
        mqttStatusText.textContent = text;
        mqttStatusCircle.className = `w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'}`;
    }

    function connectMQTT() {
        setMqttStatus("Connecting", "connecting");
        mqttClient = mqtt.connect(MQTT_CONFIG.url, {
            clientId: MQTT_CONFIG.clientId,
            username: MQTT_CONFIG.username,
            password: MQTT_CONFIG.password,
            clean: true
        });

        mqttClient.on("connect", () => {
            setMqttStatus("Connected", "connected");
            mqttClient.subscribe("smartfarm/#");
        });

        mqttClient.on("message", (topic, payload) => {
            const message = payload.toString();
            
            // Handle Time (YYYY-MM-DD HH:MM:SS)
            if (topic === "smartfarm/time") {
                const parts = message.split(" ");
                if (parts.length === 2) {
                    currentTimeElement.innerHTML = `
                        <div class="text-[10px] text-slate-400 font-normal">${parts[0]}</div>
                        <div class="leading-none">${parts[1]}</div>
                    `;
                }
            }
            
            // Handle Sensors
            if (topic === "smartfarm/sensor/dht11") {
                const data = JSON.parse(message);
                if ($("temperature")) $("temperature").textContent = data.temperature.toFixed(1);
                if ($("humidity")) $("humidity").textContent = data.humidity.toFixed(1);
            }

            // Handle Device Online
            if (topic === "smartfarm/status/online") {
                const isOnline = message === "true";
                $("espStatus").textContent = isOnline ? "Online" : "Offline";
                $("espStatus").className = `text-xl font-bold ${isOnline ? 'text-emerald-600' : 'text-rose-600'}`;
            }

            // Handle Mode
            if (topic === "smartfarm/mode/status") {
                const isAuto = message === "AUTO";
                $("currentMode").textContent = isAuto ? "Auto" : "Manual";
                $("manualModeBtn").className = isAuto ? "flex-1 py-2 rounded-lg text-sm font-medium text-slate-500" : "flex-1 py-2 rounded-lg text-sm font-medium bg-white shadow-sm text-purple-600";
                $("autoModeBtn").className = isAuto ? "flex-1 py-2 rounded-lg text-sm font-medium bg-white shadow-sm text-purple-600" : "flex-1 py-2 rounded-lg text-sm font-medium text-slate-500";
            }

            // Handle Relay Status
            if (topic.includes("relay") && topic.endsWith("status")) {
                const relay = topic.split("/")[2];
                const isOn = message === "ON";
                const toggle = $(`${relay}Toggle`);
                const text = $(`${relay}StatusText`);
                if (toggle) toggle.checked = isOn;
                if (text) {
                    text.textContent = isOn ? "เปิดใช้งานอยู่" : "ปิดการใช้งาน";
                    text.className = `text-sm font-medium ${isOn ? 'text-emerald-500' : 'text-slate-400'}`;
                }
            }

            // Handle Schedule Status
            if (topic.includes("schedule") && topic.endsWith("status")) {
                const relay = topic.split("/")[2];
                try {
                    const data = JSON.parse(message);
                    if ($(`${relay}SchedEnable`)) $(`${relay}SchedEnable`).checked = data.enabled;
                    if ($(`${relay}OnTime`)) $(`${relay}OnTime`).value = data.on;
                    if ($(`${relay}OffTime`)) $(`${relay}OffTime`).value = data.off;
                } catch(e) {
                    // Handle DELETE or non-JSON
                }
            }
        });
    }

    // Global functions for schedule
    window.saveSchedule = (relay) => {
        const data = {
            enabled: $(`${relay}SchedEnable`).checked,
            on: $(`${relay}OnTime`).value || "00:00",
            off: $(`${relay}OffTime`).value || "00:00"
        };
        mqttClient.publish(`smartfarm/schedule/${relay}/set`, JSON.stringify(data), { retain: true });
        alert(`บันทึกตารางเวลา ${relay} สำเร็จ`);
    };

    window.deleteSchedule = (relay) => {
        if (confirm(`คุณต้องการลบตารางเวลาของ ${relay} ใช่หรือไม่?`)) {
            mqttClient.publish(`smartfarm/schedule/${relay}/set`, "DELETE", { retain: true });
            $(`${relay}SchedEnable`).checked = false;
            $(`${relay}OnTime`).value = "";
            $(`${relay}OffTime`).value = "";
        }
    };

    // Relay Toggles
    ["pump", "zone1", "lighthome", "lightsala"].forEach(relay => {
        $(`${relay}Toggle`).addEventListener("change", (e) => {
            mqttClient.publish(`smartfarm/relay/${relay}/set`, e.target.checked ? "ON" : "OFF");
        });
    });

    // Mode Buttons
    $("manualModeBtn").addEventListener("click", () => mqttClient.publish("smartfarm/mode/set", "MANUAL"));
    $("autoModeBtn").addEventListener("click", () => mqttClient.publish("smartfarm/mode/set", "AUTO"));

    connectMQTT();
});
