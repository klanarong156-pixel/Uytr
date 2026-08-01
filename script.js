document.addEventListener("DOMContentLoaded", () => {
    // ============================================================
    // SMART FARM MQTT CONFIG
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
        
        pumpSet: "smartfarm/relay/pump/set",
        pumpStatus: "smartfarm/relay/pump/status",
        zone1Set: "smartfarm/relay/zone1/set",
        zone1Status: "smartfarm/relay/zone1/status",
        lightHomeSet: "smartfarm/relay/lighthome/set",
        lightHomeStatus: "smartfarm/relay/lighthome/status",
        lightSalaSet: "smartfarm/relay/lightsala/set",
        lightSalaStatus: "smartfarm/relay/lightsala/status",
        
        pumpScheduleSet: "smartfarm/schedule/pump/set",
        pumpScheduleStatus: "smartfarm/schedule/pump/status",
        zone1ScheduleSet: "smartfarm/schedule/zone1/set",
        zone1ScheduleStatus: "smartfarm/schedule/zone1/status",
        lightHomeScheduleSet: "smartfarm/schedule/lighthome/set",
        lightHomeScheduleStatus: "smartfarm/schedule/lighthome/status",
        lightSalaScheduleSet: "smartfarm/schedule/lightsala/set",
        lightSalaScheduleStatus: "smartfarm/schedule/lightsala/status"
    };

    const $ = id => document.getElementById(id);

    // ============================================================
    // DOM Elements
    // ============================================================
    const espStatusElement = $("espStatus");
    const temperatureElement = $("temperature");
    const humidityElement = $("humidity");
    const currentTimeElement = $("currentTime");
    const mqttStatusElement = $("mqttStatus");
    const mqttStatusCircle = $("mqttStatusCircle");

    const pumpToggle = $("pumpToggle");
    const zone1Toggle = $("zone1Toggle");
    const lightHomeToggle = $("lightHomeToggle");
    const lightSalaToggle = $("lightSalaToggle");

    const pumpStatusText = $("pumpStatusText");
    const zone1StatusText = $("zone1StatusText");
    const lightHomeStatusText = $("lightHomeStatusText");
    const lightSalaStatusText = $("lightSalaStatusText");

    const manualModeBtn = $("manualModeBtn");
    const autoModeBtn = $("autoModeBtn");
    const currentModeElement = $("currentMode");

    const pumpScheduleEnable = $("pumpScheduleEnable");
    const pumpOnInput = $("pumpOnInput");
    const pumpOffInput = $("pumpOffInput");
    const saveSchedulesBtn = $("saveSchedulesBtn");

    // ============================================================
    // MQTT Client
    // ============================================================
    let mqttClient = null;
    let deviceOnlineStatus = false;

    function setMqttStatus(text, status = "disconnected") {
        mqttStatusElement.textContent = text;
        mqttStatusCircle.className = "w-2 h-2 rounded-full " + 
            (status === "connected" ? "bg-emerald-500 animate-pulse" : 
             status === "connecting" ? "bg-amber-500 animate-bounce" : "bg-rose-500");
        mqttStatusElement.className = "text-[10px] uppercase font-bold " + 
            (status === "connected" ? "text-emerald-600" : 
             status === "connecting" ? "text-amber-600" : "text-rose-600");
    }

    function updateRelayUI(checkbox, statusText, message) {
        if (!checkbox) return;
        const state = String(message).trim().toUpperCase();
        const isOn = state === "ON";
        checkbox.checked = isOn;
        if (statusText) {
            statusText.textContent = isOn ? "เปิดใช้งานอยู่" : "ปิดการใช้งาน";
            statusText.className = "text-sm font-medium " + (isOn ? "text-emerald-500" : "text-slate-400");
        }
    }

    function updateModeUI(mode) {
        const isAuto = String(mode).trim().toUpperCase() === "AUTO";
        currentModeElement.textContent = isAuto ? "Auto" : "Manual";
        
        manualModeBtn.className = isAuto ? 
            "flex-1 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700" : 
            "flex-1 py-2 rounded-lg text-sm font-medium bg-white shadow-sm text-purple-600";
        
        autoModeBtn.className = isAuto ? 
            "flex-1 py-2 rounded-lg text-sm font-medium bg-white shadow-sm text-purple-600" : 
            "flex-1 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700";
    }

    function updateUI(topic, message) {
        message = String(message);

        switch (topic) {
            case TOPIC.online:
                const isOnline = message.toLowerCase() === "true";
                deviceOnlineStatus = isOnline;
                espStatusElement.textContent = isOnline ? "Online" : "Offline";
                espStatusElement.className = "text-xl font-bold " + (isOnline ? "text-emerald-600" : "text-rose-600");
                break;

            case TOPIC.sensor:
                try {
                    const data = JSON.parse(message);
                    if (data.temperature !== undefined) temperatureElement.textContent = data.temperature.toFixed(1);
                    if (data.humidity !== undefined) humidityElement.textContent = data.humidity.toFixed(1);
                } catch (e) {
                    console.error("DHT11 JSON error:", e, message);
                }
                break;

            case TOPIC.time:
                currentTimeElement.textContent = message;
                break;

            case TOPIC.pumpStatus:
                updateRelayUI(pumpToggle, pumpStatusText, message);
                break;

            case TOPIC.zone1Status:
                updateRelayUI(zone1Toggle, zone1StatusText, message);
                break;

            case TOPIC.lightHomeStatus:
                updateRelayUI(lightHomeToggle, lightHomeStatusText, message);
                break;

            case TOPIC.lightSalaStatus:
                updateRelayUI(lightSalaToggle, lightSalaStatusText, message);
                break;

            case TOPIC.modeStatus:
                updateModeUI(message);
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
            console.warn("MQTT not connected, cannot publish to " + topic);
            return false;
        }
        mqttClient.publish(topic, String(message), { qos: 1, retain: false });
        return true;
    }

    function connectMQTT() {
        if (!window.mqtt) {
            setMqttStatus("No Library", "error");
            return;
        }

        setMqttStatus("Connecting", "connecting");

        const options = {
            clientId: MQTT_CONFIG.clientId,
            clean: true,
            connectTimeout: 10000,
            reconnectPeriod: 5000,
            username: MQTT_CONFIG.username,
            password: MQTT_CONFIG.password,
            will: {
                topic: TOPIC.online,
                payload: "false",
                qos: 0,
                retain: true
            }
        };

        mqttClient = mqtt.connect(MQTT_CONFIG.url, options);

        mqttClient.on("connect", () => {
            setMqttStatus("Connected", "connected");
            // Subscribe to all status topics
            const topics = [
                TOPIC.online,
                TOPIC.sensor,
                TOPIC.time,
                TOPIC.modeStatus,
                TOPIC.pumpStatus,
                TOPIC.zone1Status,
                TOPIC.lightHomeStatus,
                TOPIC.lightSalaStatus,
                TOPIC.pumpScheduleStatus,
                TOPIC.zone1ScheduleStatus,
                TOPIC.lightHomeScheduleStatus,
                TOPIC.lightSalaScheduleStatus
            ];
            mqttClient.subscribe(topics, { qos: 1 });
            console.log("Subscribed to all topics");
        });

        mqttClient.on("message", (topic, payload) => {
            updateUI(topic, payload.toString());
        });

        mqttClient.on("reconnect", () => setMqttStatus("Reconnecting", "connecting"));
        mqttClient.on("offline", () => setMqttStatus("Offline", "error"));
        mqttClient.on("close", () => setMqttStatus("Disconnected", "error"));
        mqttClient.on("error", err => {
            setMqttStatus("Error", "error");
            console.error("MQTT Error:", err);
        });
    }

    // ============================================================
    // Event Listeners
    // ============================================================
    
    const handleToggle = (checkbox, topic) => {
        const nextState = checkbox.checked ? "ON" : "OFF";
        if (!publish(topic, nextState)) {
            // Revert on failure
            checkbox.checked = !checkbox.checked;
        }
    };

    pumpToggle.addEventListener("change", () => handleToggle(pumpToggle, TOPIC.pumpSet));
    zone1Toggle.addEventListener("change", () => handleToggle(zone1Toggle, TOPIC.zone1Set));
    lightHomeToggle.addEventListener("change", () => handleToggle(lightHomeToggle, TOPIC.lightHomeSet));
    lightSalaToggle.addEventListener("change", () => handleToggle(lightSalaToggle, TOPIC.lightSalaSet));

    manualModeBtn.addEventListener("click", () => {
        if (publish(TOPIC.modeSet, "MANUAL")) {
            updateModeUI("MANUAL");
        }
    });

    autoModeBtn.addEventListener("click", () => {
        if (publish(TOPIC.modeSet, "AUTO")) {
            updateModeUI("AUTO");
        }
    });

    saveSchedulesBtn.addEventListener("click", () => {
        const schedule = {
            enabled: pumpScheduleEnable.checked,
            on: pumpOnInput.value,
            off: pumpOffInput.value
        };
        if (publish(TOPIC.pumpScheduleSet, JSON.stringify(schedule))) {
            const originalText = saveSchedulesBtn.innerHTML;
            const originalClass = saveSchedulesBtn.className;
            saveSchedulesBtn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i><span>บันทึกสำเร็จ</span>';
            saveSchedulesBtn.className = "w-full mt-6 bg-blue-600 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center space-x-2";
            lucide.createIcons();
            setTimeout(() => {
                saveSchedulesBtn.innerHTML = originalText;
                saveSchedulesBtn.className = originalClass;
                lucide.createIcons();
            }, 2000);
        } else {
            alert("ไม่สามารถบันทึกได้ เนื่องจาก MQTT ไม่เชื่อมต่อ");
        }
    });

    // ============================================================
    // Initialization
    // ============================================================
    connectMQTT();
});
