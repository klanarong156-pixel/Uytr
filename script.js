document.addEventListener("DOMContentLoaded", () => {

    // ==================== PAGE NAVIGATION (Tesla-style bottom nav) ====================
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
            item.classList.add("active");
            const page = item.dataset.page;
            document.querySelectorAll(".page-section").forEach(p => p.classList.remove("active"));
            document.getElementById("page-" + page).classList.add("active");
        });
    });

    // Settings modal
    document.getElementById("settingsBtn").addEventListener("click", () => {
        document.getElementById("settingsModal").classList.add("show");
    });

    window.closeSettingsModal = () => {
        document.getElementById("settingsModal").classList.remove("show");
    };

    document.getElementById("settingsModal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("settingsModal")) {
            closeSettingsModal();
        }
    });

    window.applyMqttSettings = () => {
        MQTT_CONFIG.url = document.getElementById("mqttUrl").value;
        MQTT_CONFIG.username = document.getElementById("mqttUser").value;
        MQTT_CONFIG.password = document.getElementById("mqttPass").value;
        showToast("บันทึกการตั้งค่า MQTT แล้ว กำลังเชื่อมต่อใหม่...", "info");
        closeSettingsModal();
        connectMQTT();
    };

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
    let schedData = {};
    let activityLog = [];
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let deviceTimeOffset = 0;
    let lastDeviceTime = null;

    const $ = id => document.getElementById(id);

    // ==================== TOAST NOTIFICATIONS ====================
    function showToast(message, type = "info", duration = 3000) {
        const container = $("toastContainer");
        const toast = document.createElement("div");
        const colors = {
            success: "bg-gradient-to-r from-emerald-500 to-green-600",
            error: "bg-gradient-to-r from-rose-500 to-red-600",
            info: "bg-gradient-to-r from-blue-500 to-cyan-600",
            warning: "bg-gradient-to-r from-amber-500 to-orange-600",
            dark: "bg-slate-700 dark:bg-slate-600"
        };
        toast.className = `toast-enter pointer-events-auto px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold ${colors[type] || colors.info} flex items-center gap-2`;
        
        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", 
            type === "success" ? "check-circle" :
            type === "error" ? "alert-circle" :
            type === "warning" ? "alert-triangle" : "info"
        );
        icon.className = "w-4 h-4";
        
        const textSpan = document.createElement("span");
        textSpan.textContent = message;
        
        toast.appendChild(icon);
        toast.appendChild(textSpan);
        container.appendChild(toast);
        
        lucide.createIcons();
        
        setTimeout(() => {
            toast.className = toast.className.replace("toast-enter", "toast-exit");
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ==================== CONNECTION STATUS ====================
    function setConnStatus(text, status) {
        const dot = $("connDot");
        const label = $("connText");
        const wifiText = $("wifiStatusText");
        
        label.textContent = text;
        if (wifiText) wifiText.textContent = text;
        
        const dotColor = status === "connected" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-rose-400";
        const textColor = status === "connected" ? "text-emerald-400" : status === "connecting" ? "text-amber-400" : "text-rose-400";
        
        dot.className = "w-2 h-2 rounded-full pulse-dot " + dotColor;
        label.className = "text-[10px] font-semibold " + textColor;
        
        if (wifiText) {
            const wifiBadge = wifiText.parentElement;
            wifiBadge.className = wifiBadge.className.replace(/bg-\w+-500\/10|text-\w+-400|border-\w+-500\/20/g, "");
            if (status === "connected") {
                wifiBadge.classList.add("bg-blue-500/10", "text-blue-400", "border-blue-500/20");
            } else if (status === "connecting") {
                wifiBadge.classList.add("bg-amber-500/10", "text-amber-400", "border-amber-500/20");
            } else {
                wifiBadge.classList.add("bg-rose-500/10", "text-rose-400", "border-rose-500/20");
            }
        }
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
            container.innerHTML = '<p class="text-xs text-[#8E8E93] text-center py-8">ยังไม่มีกิจกรรม</p>';
            return;
        }
        const icons = { 
            relay: "power", 
            mode: "settings-2", 
            sensor: "thermometer", 
            schedule: "calendar", 
            connection: "wifi", 
            error: "alert-circle" 
        };
        container.innerHTML = activityLog.slice(0, 20).map(a => {
            const icon = icons[a.type] || "info";
            const colorMap = { 
                relay: "text-emerald-400", 
                mode: "text-purple-400", 
                sensor: "text-blue-400", 
                schedule: "text-amber-400", 
                connection: "text-indigo-400", 
                error: "text-rose-400" 
            };
            return `<div class="log-item">
                <span class="text-[10px] text-[#8E8E93] font-mono w-14 flex-shrink-0">${a.time}</span>
                <i data-lucide="${icon}" class="w-4 h-4 ${colorMap[a.type] || 'text-[#8E8E93]'} flex-shrink-0"></i>
                <span class="text-xs text-white flex-1">${a.message}</span>
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
            addActivity(`อุณหภูมิ: ${value.toFixed(1)}°C`, "sensor");
        } else {
            $("humidity").textContent = value.toFixed(1);
            bar.style.width = Math.min(100, value) + "%";
            addActivity(`ความชื้น: ${value.toFixed(1)}%`, "sensor");
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
            text.className = "text-[10px] " + (isOn ? "text-emerald-400 font-medium" : "text-[#8E8E93]");
        }
        const card = $(`card-${relay}`);
        if (card) {
            if (isOn) {
                card.classList.add("active");
            } else {
                card.classList.remove("active");
            }
        }
        // Update quick status on home page
        const quickStatus = $(`${relay}QuickStatus`);
        if (quickStatus) {
            quickStatus.textContent = isOn ? "เปิด" : "ปิด";
            quickStatus.className = "text-[9px] font-semibold " + (isOn ? "text-emerald-400" : "text-[#8E8E93]");
        }
    }

    // ==================== MODE UPDATE ====================
    function updateMode(isAuto) {
        $("currentMode").textContent = isAuto ? "Auto Mode" : "Manual Mode";
        $("currentMode").className = isAuto ? "text-xs text-emerald-400 font-medium" : "text-xs text-[#8E8E93] font-medium";
        $("manualModeBtn").className = isAuto ? "" : "active-mode";
        $("autoModeBtn").className = isAuto ? "active-mode" : "";
    }

    // ==================== SCHEDULE TAB ====================
    window.switchSchedTab = (relay) => {
        currentSchedTab = relay;
        document.querySelectorAll(".sched-tab-btn").forEach(btn => {
            const isActive = btn.dataset.tab === relay;
            btn.className = "sched-tab-btn flex-1 text-center " +
                (isActive ? "sched-active" : "");
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
            el.innerHTML = `<span class="text-emerald-400 font-semibold">${RELAY_NAMES[relay]}</span> ตั้งเวลา <b class="text-white">${data.on}</b> - <b class="text-white">${data.off}</b>`;
        } else if (data.enabled) {
            el.innerHTML = `<span class="text-amber-400 font-semibold">กำหนดเวลาเปิด/ปิดของ ${RELAY_NAMES[relay]}</span>`;
        } else {
            el.innerHTML = `<span class="text-[#8E8E93]">ยังไม่เปิดใช้งานตารางเวลาของ ${RELAY_NAMES[relay]}</span>`;
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

    // ==================== REAL-TIME CLOCK ====================
    function startLocalClock() {
        setInterval(() => {
            const now = new Date();
            let displayTime;
            if (lastDeviceTime) {
                displayTime = new Date(now.getTime() + deviceTimeOffset);
            } else {
                displayTime = now;
            }
            
            const timeStr = displayTime.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
            const dateStr = displayTime.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-");
            
            const seconds = displayTime.getSeconds();
            const blinkClass = seconds % 2 === 0 ? "opacity-100" : "opacity-30";
            const [h, m] = timeStr.split(":");
            
            $("currentTime").innerHTML = `<span class="font-mono">${h}<span class="${blinkClass} transition-opacity duration-500">:</span>${m}</span>`;
            $("currentDate").textContent = dateStr;
        }, 1000);
    }
    startLocalClock();

    // ==================== MQTT CONNECT ====================
    function connectMQTT() {
        if (mqttClient) {
            try { mqttClient.end(); } catch (e) {}
        }

        setConnStatus("เชื่อมต่อ...", "connecting");

        const options = {
            clientId: MQTT_CONFIG.clientId,
            username: MQTT_CONFIG.username,
            password: MQTT_CONFIG.password,
            path: '/mqtt',
            clean: true,
            connectTimeout: 10000,
            reconnectPeriod: 5000,
            protocolVersion: 4,
            keepalive: 60
        };

        console.log("Connecting to MQTT...", MQTT_CONFIG.url);
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

                if (topic === "smartfarm/time") {
                    const parts = message.split(" ");
                    if (parts.length === 2) {
                        const [year, month, day] = parts[0].split("-").map(Number);
                        const [hour, min, sec] = parts[1].split(":").map(Number);
                        const deviceTime = new Date(year, month - 1, day, hour, min, sec);
                        const localTime = new Date();
                        deviceTimeOffset = deviceTime.getTime() - localTime.getTime();
                        lastDeviceTime = deviceTime;
                        
                        const displayTime = parts[1].split(":").slice(0, 2).join(":");
                        $("currentTime").innerHTML = `<span class="font-mono">${displayTime}</span>`;
                        $("currentDate").textContent = parts[0];
                    }
                }

                if (topic === "smartfarm/sensor/dht11") {
                    const data = JSON.parse(message);
                    if (data.temperature !== undefined) updateSensor("temperature", data.temperature);
                    if (data.humidity !== undefined) updateSensor("humidity", data.humidity);
                }

                if (topic === "smartfarm/status/online") {
                    const isOnline = message === "true";
                    $("espDot").className = `w-2 h-2 rounded-full pulse-dot ${isOnline ? "bg-emerald-400" : "bg-rose-400"}`;
                    $("espStatus").textContent = isOnline ? "Online" : "Offline";
                    $("espStatus").className = `text-[10px] font-semibold ${isOnline ? "text-emerald-400" : "text-rose-400"}`;
                    addActivity(`อุปกรณ์ ${isOnline ? "ออนไลน์" : "ออฟไลน์"}`, "connection");
                }

                if (topic === "smartfarm/mode/status") {
                    const isAuto = message === "AUTO";
                    updateMode(isAuto);
                }

                if (topic.includes("relay") && topic.endsWith("status")) {
                    const relay = topic.split("/")[2];
                    const isOn = message === "ON";
                    if (RELAYS.includes(relay)) {
                        updateRelayState(relay, isOn);
                    }
                }

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
        const toggle = $(`${relay}Toggle`);
        if (toggle) {
            toggle.addEventListener("change", (e) => {
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
        }
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

    // Load dark mode preference
    if (localStorage.getItem("darkMode") === "true") {
        document.documentElement.classList.add("dark");
        const icon = $("darkModeBtn").querySelector("i");
        icon.setAttribute("data-lucide", "sun");
    }

    // ==================== SCHEDULE TAB CLICKS ====================
    document.querySelectorAll(".sched-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            window.switchSchedTab(btn.dataset.tab);
        });
    });

    // ==================== INITIALIZE ====================
    connectMQTT();
    window.switchSchedTab("pump");
    lucide.createIcons();

    // Reconnect every 30 seconds if disconnected
    setInterval(() => {
        if (!mqttClient || !mqttClient.connected) {
            connectMQTT();
        }
    }, 30000);

});
