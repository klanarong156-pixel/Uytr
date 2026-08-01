document.addEventListener("DOMContentLoaded", () => {

    // ==================== CONFIG ====================
    const MQTT_CONFIG = {
        url: "wss://650188a0ee2b4367b7c131fb385590a9.s1.eu.hivemq.cloud:8884/mqtt",
        username: "smartfarm",
        password: "Kla12345",
        clientId: "SmartFarmWeb-" + Math.random().toString(16).slice(2)
    };

    const RELAYS = ["pump", "zone1", "lighthome", "lightsala"];
    const RELAY_NAMES = { pump: "ปั๊มน้ำ", zone1: "โซน 1", lighthome: "ไฟบ้าน", lightsala: "ไฟศาลา" };
    const RELAY_COLORS = { pump: "blue", zone1: "emerald", lighthome: "orange", lightsala: "amber" };

    let mqttClient = null;
    let currentSchedTab = "pump";
    let schedData = {}; // cache schedule data per relay
    let activityLog = [];
    let reconnectAttempts = 0;
    let reconnectTimer = null;

    const $ = id => document.getElementById(id);

    // ==================== TOAST NOTIFICATIONS ====================
    function showToast(message, type = "info", duration = 3000) {
        const container = $("toastContainer");
        const toast = document.createElement("div");
        const colors = {
            success: "bg-emerald-500", error: "bg-rose-500", info: "bg-blue-500",
            warning: "bg-amber-500", dark: "bg-slate-700 dark:bg-slate-600"
        };
        toast.className = `toast-enter pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-white text-xs font-medium ${colors[type] || colors.info}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.className = toast.className.replace("toast-enter", "toast-exit");
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ==================== CONNECTION STATUS ====================
    function setConnStatus(text, status) {
        const dot = $("connDot");
        const label = $("connText");
        label.textContent = text;
        dot.className = "w-2.5 h-2.5 rounded-full " + (
            status === "connected" ? "bg-emerald-400" :
            status === "connecting" ? "bg-amber-400 animate-pulse" : "bg-rose-400"
        );
        label.className = "text-xs font-medium " + (
            status === "connected" ? "text-emerald-600 dark:text-emerald-400" :
            status === "connecting" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
        );
    }

    // ==================== ACTIVITY LOG ====================
    function addActivity(message, type = "info") {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        activityLog.unshift({ time: timeStr, message, type });
        if (activityLog.length > 50) activityLog.pop();
        renderActivityLog();
    }

    function renderActivityLog() {
        const container = $("activityLog");
        if (activityLog.length === 0) {
            container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">ยังไม่มีกิจกรรม</p>';
            return;
        }
        const icons = { relay: "power", mode: "settings-2", sensor: "thermometer", schedule: "calendar", connection: "wifi", error: "alert-circle" };
        container.innerHTML = activityLog.slice(0, 20).map(a => {
            const icon = icons[a.type] || "info";
            const colorMap = { relay: "text-emerald-500", mode: "text-purple-500", sensor: "text-blue-500", schedule: "text-amber-500", connection: "text-indigo-500", error: "text-rose-500" };
            return `<div class="flex items-center gap-2 text-xs py-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <span class="text-slate-400 font-mono w-14">${a.time}</span>
                <i data-lucide="${icon}" class="w-3 h-3 ${colorMap[a.type] || 'text-slate-400'}"></i>
                <span class="text-slate-600 dark:text-slate-300 flex-1">${a.message}</span>
            </div>`;
        }).join("");
        lucide.createIcons();
    }

    // ==================== SENSOR UPDATES ====================
    function updateSensor(type, value) {
        const bar = type === "temperature" ? $("tempBar").querySelector("div") : $("humBar").querySelector("div");
        const timeEl = type === "temperature" ? $("tempTime") : $("humTime");
        const now = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

        if (type === "temperature") {
            $("temperature").textContent = value.toFixed(1);
            const pct = Math.min(100, Math.max(0, ((value + 10) / 60) * 100));
            bar.style.width = pct + "%";
        } else {
            $("humidity").textContent = value.toFixed(1);
            bar.style.width = Math.min(100, value) + "%";
        }
        timeEl.textContent = now;
    }

    // ==================== RELAY STATE ====================
    function updateRelayState(relay, isOn) {
        const toggle = $(`${relay}Toggle`);
        const text = $(`${relay}StatusText`);
        if (toggle) toggle.checked = isOn;
        if (text) {
            text.textContent = isOn ? "เปิด" : "ปิด";
            text.className = "text-xs font-medium " + (isOn ? "text-emerald-500" : "text-slate-400");
        }
        const card = $(`card-${relay}`);
        if (card) {
            card.style.borderColor = isOn ? "var(--tw-color-emerald-500)" : "";
            card.classList.toggle("ring-1", isOn);
            card.classList.toggle("ring-emerald-400/30", isOn);
        }
    }

    // ==================== MODE UPDATE ====================
    function updateMode(isAuto) {
        $("currentMode").textContent = isAuto ? "Auto" : "Manual";
        $("currentMode").className = `px-2 py-0.5 rounded-full text-xs font-bold ${isAuto ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"}`;
        $("manualModeBtn").className = isAuto ? "px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 transition-all" : "px-4 py-2 rounded-lg text-xs font-semibold transition-all tab-active";
        $("autoModeBtn").className = isAuto ? "px-4 py-2 rounded-lg text-xs font-semibold transition-all tab-active" : "px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 transition-all";
    }

    // ==================== SCHEDULE TAB ====================
    window.switchSchedTab = (relay) => {
        currentSchedTab = relay;
        document.querySelectorAll(".sched-tab").forEach(btn => {
            const isActive = btn.dataset.tab === relay;
            btn.className = "sched-tab flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors " +
                (isActive ? "border-emerald-500 tab-active" : "border-transparent text-slate-500 dark:text-slate-400");
        });
        const data = schedData[relay] || { enabled: false, on: "", off: "" };
        $("schedEnable").checked = data.enabled;
        $("schedOn").value = data.on || "";
        $("schedOff").value = data.off || "";
        updateSchedSummary(relay, data);
    };

    function updateSchedSummary(relay, data) {
        const el = $("schedSummary");
        if (data.enabled && data.on && data.off) {
            el.innerHTML = `<span class="text-emerald-500 font-medium">${RELAY_NAMES[relay]}</span> ตั้งเวลา <b>${data.on}</b> - <b>${data.off}</b>`;
        } else if (data.enabled) {
            el.innerHTML = `<span class="text-amber-500">กำหนดเวลาเปิด/ปิดของ ${RELAY_NAMES[relay]}</span>`;
        } else {
            el.innerHTML = `<span class="text-slate-400">ยังไม่เปิดใช้งานตารางเวลาของ ${RELAY_NAMES[relay]}</span>`;
        }
    }

    // ==================== SAVE / DELETE SCHEDULE ====================
    window.saveSchedule = () => {
        const data = {
            enabled: $("schedEnable").checked,
            on: $("schedOn").value || "00:00",
            off: $("schedOff").value || "00:00"
        };
        if (!mqttClient || !mqttClient.connected) {
            showToast("ยังไม่ได้เชื่อมต่อ MQTT", "error");
            return;
        }
        mqttClient.publish(`smartfarm/schedule/${currentSchedTab}/set`, JSON.stringify(data), { retain: true });
        schedData[currentSchedTab] = data;
        updateSchedSummary(currentSchedTab, data);
        showToast(`บันทึกตารางเวลา ${RELAY_NAMES[currentSchedTab]} แล้ว`, "success");
        addActivity(`ตั้งค่าตารางเวลา ${RELAY_NAMES[currentSchedTab]}: ${data.enabled ? "เปิด" : "ปิด"} ${data.on}-${data.off}`, "schedule");
    };

    window.deleteSchedule = () => {
        if (!mqttClient || !mqttClient.connected) {
            showToast("ยังไม่ได้เชื่อมต่อ MQTT", "error");
            return;
        }
        mqttClient.publish(`smartfarm/schedule/${currentSchedTab}/set`, "DELETE", { retain: true });
        schedData[currentSchedTab] = { enabled: false, on: "", off: "" };
        $("schedEnable").checked = false;
        $("schedOn").value = "";
        $("schedOff").value = "";
        updateSchedSummary(currentSchedTab, schedData[currentSchedTab]);
        showToast(`ลบตารางเวลา ${RELAY_NAMES[currentSchedTab]} แล้ว`, "info");
        addActivity(`ลบตารางเวลา ${RELAY_NAMES[currentSchedTab]}`, "schedule");
    };

    // ==================== ALL RELAYS ====================
    window.allRelays = (state) => {
        if (!mqttClient || !mqttClient.connected) {
            showToast("ยังไม่ได้เชื่อมต่อ MQTT", "error");
            return;
        }
        const action = state ? "เปิด" : "ปิด";
        RELAYS.forEach(relay => {
            mqttClient.publish(`smartfarm/relay/${relay}/set`, state ? "ON" : "OFF");
            updateRelayState(relay, state);
        });
        showToast(`${action}อุปกรณ์ทั้งหมดแล้ว`, "success");
        addActivity(`${action}อุปกรณ์ทั้งหมด`, "relay");
    };

    // ==================== MQTT CONNECT ====================
    function connectMQTT() {
        if (mqttClient) {
            try { mqttClient.end(); } catch (e) {}
        }

        setConnStatus("เชื่อมต่อ...", "connecting");

        // HiveMQ Cloud requires specific options for browser connection
        const options = {
            clientId: MQTT_CONFIG.clientId,
            username: MQTT_CONFIG.username,
            password: MQTT_CONFIG.password,
            path: '/mqtt',         // Path is required for HiveMQ Cloud WebSockets
            clean: true,
            connectTimeout: 10000,
            reconnectPeriod: 5000,
            protocolVersion: 4,
            keepalive: 60
        };

        console.log("Connecting to MQTT...", MQTT_CONFIG.url);
        // We use the full URL but also pass path in options for redundancy
        mqttClient = mqtt.connect(MQTT_CONFIG.url, options);

        mqttClient.on("connect", () => {
            setConnStatus("เชื่อมต่อแล้ว", "connected");
            mqttClient.subscribe("smartfarm/#");
            showToast("เชื่อมต่อ MQTT สำเร็จ", "success");
            addActivity("เชื่อมต่อ MQTT สำเร็จ", "connection");
        });

        mqttClient.on("reconnect", () => {
            setConnStatus("กำลังลองใหม่...", "connecting");
            addActivity("กำลังพยายามเชื่อมต่อใหม่...", "connection");
        });

        mqttClient.on("offline", () => {
            setConnStatus("ออฟไลน์", "disconnected");
        });

        mqttClient.on("error", (err) => {
            console.error("MQTT Error:", err);
            setConnStatus("เกิดข้อผิดพลาด", "disconnected");
            showToast("MQTT Error: " + err.message, "error");
        });

        mqttClient.on("close", () => {
            setConnStatus("ขาดการเชื่อมต่อ", "disconnected");
        });

        mqttClient.on("message", (topic, payload) => {
            try {
                const message = payload.toString();

                // Time
                if (topic === "smartfarm/time") {
                    const parts = message.split(" ");
                    if (parts.length === 2) {
                        $("currentTime").innerHTML = `<span class="font-mono">${parts[1]}</span>`;
                        $("currentDate").textContent = parts[0];
                    }
                }

                // Sensors
                if (topic === "smartfarm/sensor/dht11") {
                    const data = JSON.parse(message);
                    if (data.temperature !== undefined) updateSensor("temperature", data.temperature);
                    if (data.humidity !== undefined) updateSensor("humidity", data.humidity);
                }

                // Device Online
                if (topic === "smartfarm/status/online") {
                    const isOnline = message === "true";
                    $("espDot").className = `w-3 h-3 rounded-full ${isOnline ? "bg-emerald-400" : "bg-rose-400"}`;
                    $("espStatus").textContent = isOnline ? "Online" : "Offline";
                    $("espStatus").className = `text-lg font-bold ${isOnline ? "text-emerald-500" : "text-rose-500"}`;
                    addActivity(`อุปกรณ์ ${isOnline ? "ออนไลน์" : "ออฟไลน์"}`, "connection");
                }

                // Mode
                if (topic === "smartfarm/mode/status") {
                    const isAuto = message === "AUTO";
                    updateMode(isAuto);
                }

                // Relay Status
                if (topic.includes("relay") && topic.endsWith("status")) {
                    const relay = topic.split("/")[2];
                    const isOn = message === "ON";
                    if (RELAYS.includes(relay)) {
                        updateRelayState(relay, isOn);
                    }
                }

                // Schedule Status
                if (topic.includes("schedule") && topic.endsWith("status")) {
                    const relay = topic.split("/")[2];
                    if (RELAYS.includes(relay)) {
                        try {
                            const data = JSON.parse(message);
                            schedData[relay] = { enabled: data.enabled, on: data.on, off: data.off };
                            if (relay === currentSchedTab) {
                                $("schedEnable").checked = data.enabled;
                                $("schedOn").value = data.on || "";
                                $("schedOff").value = data.off || "";
                                updateSchedSummary(relay, data);
                            }
                        } catch (e) {
                            schedData[relay] = { enabled: false, on: "", off: "" };
                        }
                    }
                }

            } catch (e) {
                console.warn("Message parse error:", topic, e.message);
            }
        });
    }


    // ==================== RELAY TOGGLES ====================
    RELAYS.forEach(relay => {
        $(`${relay}Toggle`).addEventListener("change", (e) => {
            if (!mqttClient || !mqttClient.connected) {
                showToast("ยังไม่ได้เชื่อมต่อ MQTT", "error");
                e.target.checked = !e.target.checked;
                return;
            }
            const state = e.target.checked ? "ON" : "OFF";
            mqttClient.publish(`smartfarm/relay/${relay}/set`, state);
            updateRelayState(relay, e.target.checked);
            showToast(`${RELAY_NAMES[relay]}: ${e.target.checked ? "เปิด" : "ปิด"}`, "success", 2000);
            addActivity(`${RELAY_NAMES[relay]} → ${e.target.checked ? "เปิด" : "ปิด"}`, "relay");
        });
    });

    // ==================== MODE BUTTONS ====================
    $("manualModeBtn").addEventListener("click", () => {
        if (!mqttClient || !mqttClient.connected) {
            showToast("ยังไม่ได้เชื่อมต่อ MQTT", "error");
            return;
        }
        mqttClient.publish("smartfarm/mode/set", "MANUAL");
        showToast("เปลี่ยนเป็นโหมด Manual", "info");
        addActivity("เปลี่ยนโหมด → Manual", "mode");
    });

    $("autoModeBtn").addEventListener("click", () => {
        if (!mqttClient || !mqttClient.connected) {
            showToast("ยังไม่ได้เชื่อมต่อ MQTT", "error");
            return;
        }
        mqttClient.publish("smartfarm/mode/set", "AUTO");
        showToast("เปลี่ยนเป็นโหมด Auto", "info");
        addActivity("เปลี่ยนโหมด → Auto", "mode");
    });

    // ==================== DARK MODE ====================
    $("darkModeBtn").addEventListener("click", () => {
        document.documentElement.classList.toggle("dark");
        const isDark = document.documentElement.classList.contains("dark");
        localStorage.setItem("darkMode", isDark ? "true" : "false");
        const icon = $("darkModeBtn").querySelector("i");
        icon.setAttribute("data-lucide", isDark ? "sun" : "moon");
        lucide.createIcons();
    });

    // Load saved dark mode
    if (localStorage.getItem("darkMode") === "true") {
        document.documentElement.classList.add("dark");
        const icon = $("darkModeBtn").querySelector("i");
        icon.setAttribute("data-lucide", "sun");
        lucide.createIcons();
    }

    // ==================== INIT ====================
    connectMQTT();
    switchSchedTab("pump");
    addActivity("ระบบเริ่มทำงาน", "connection");
});
