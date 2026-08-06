// Smart Farm Dashboard - Main Logic (UI & Coordination)

document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    // ==================== PAGE NAVIGATION ====================
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
            item.classList.add("active");
            const page = item.dataset.page;
            document.querySelectorAll(".page-section").forEach(p => p.classList.remove("active"));
            const targetPage = document.getElementById("page-" + page);
            if (targetPage) targetPage.classList.add("active");
        });
    });

    // ==================== SETTINGS MODAL ====================
    const settingsBtn = document.getElementById("settingsBtn");
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
            const modal = document.getElementById("settingsModal");
            if (modal) modal.classList.add("show");
        });
    }

    window.closeSettingsModal = () => {
        const modal = document.getElementById("settingsModal");
        if (modal) modal.classList.remove("show");
    };

    window.applyMqttSettings = () => {
        if (typeof MQTT_CONFIG !== 'undefined') {
            const urlEl = $("mqttUrl");
            const userEl = $("mqttUser");
            const passEl = $("mqttPass");
            if (urlEl) MQTT_CONFIG.url = urlEl.value;
            if (userEl) MQTT_CONFIG.username = userEl.value;
            if (passEl) MQTT_CONFIG.password = passEl.value;
        }
        showToast("บันทึกการตั้งค่า MQTT แล้ว กำลังเชื่อมต่อใหม่...", "info");
        closeSettingsModal();
        if (window.mqttHandler) window.mqttHandler.connect();
    };

    // ==================== TOAST NOTIFICATIONS ====================
    window.showToast = function(message, type = "info", duration = 3000) {
        const container = $("toastContainer");
        if (!container) return;
        
        const toast = document.createElement("div");
        const colors = {
            success: "bg-gradient-to-r from-emerald-500 to-green-600",
            error: "bg-gradient-to-r from-rose-500 to-red-600",
            info: "bg-gradient-to-r from-blue-500 to-cyan-600",
            warning: "bg-gradient-to-r from-amber-500 to-orange-600"
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
        
        if (window.lucide) lucide.createIcons();
        
        setTimeout(() => {
            toast.className = toast.className.replace("toast-enter", "toast-exit");
            setTimeout(() => toast.remove(), 300);
        }, duration);
    };

    // ==================== ACTIVITY LOG ====================
    let activityLog = [];
    window.addActivity = function(message, type = "info") {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        activityLog.unshift({ time: timeStr, message, type });
        if (activityLog.length > 50) activityLog.pop();
        renderActivityLog();
    };

    function renderActivityLog() {
        const container = $("activityLog");
        if (!container) return;
        if (activityLog.length === 0) {
            container.innerHTML = '<p class="text-xs text-[#8E8E93] text-center py-8">ยังไม่มีกิจกรรม</p>';
            return;
        }
        const icons = { relay: "power", mode: "settings-2", sensor: "thermometer", schedule: "calendar", connection: "wifi", error: "alert-circle" };
        container.innerHTML = activityLog.slice(0, 20).map(a => {
            const icon = icons[a.type] || "info";
            const colorMap = { relay: "text-emerald-400", mode: "text-purple-400", sensor: "text-blue-400", schedule: "text-amber-400", connection: "text-indigo-400", error: "text-rose-400" };
            return `<div class="log-item">
                <span class="text-[10px] text-[#8E8E93] font-mono w-14 flex-shrink-0">${a.time}</span>
                <i data-lucide="${icon}" class="w-4 h-4 ${colorMap[a.type] || 'text-[#8E8E93]'} flex-shrink-0"></i>
                <span class="text-xs text-white flex-1">${a.message}</span>
            </div>`;
        }).join("");
        if (window.lucide) lucide.createIcons();
    }

    // ==================== MQTT STATUS UI ====================
    window.addEventListener('mqtt:connected', (e) => {
        const isConnected = e.detail;
        const dot = $("connDot");
        const label = $("connText");
        const wifiText = $("wifiStatusText");
        
        if (label) label.textContent = isConnected ? "เชื่อมต่อแล้ว" : "ขาดการเชื่อมต่อ";
        if (wifiText) wifiText.textContent = isConnected ? "เชื่อมต่อแล้ว" : "ขาดการเชื่อมต่อ";
        
        const color = isConnected ? "emerald" : "rose";
        if (dot) dot.className = `w-2 h-2 rounded-full pulse-dot bg-${color}-400`;
        if (label) label.className = `text-[10px] font-semibold text-${color}-400`;
        
        if (wifiText) {
            const badge = wifiText.parentElement;
            badge.className = `px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-${color}-500/10 text-${color}-400 border border-${color}-500/20 flex items-center gap-1.5`;
        }

        if (isConnected) {
            showToast("เชื่อมต่อ MQTT สำเร็จ", "success");
            addActivity("เชื่อมต่อ MQTT สำเร็จ", "connection");
        } else {
            showToast("ขาดการเชื่อมต่อ MQTT", "error");
            addActivity("ขาดการเชื่อมต่อ MQTT", "error");
        }
    });

<<<<<<< HEAD
    // ==================== ALL RELAYS ====================
    window.allRelays = (state) => {
        const action = state ? "เปิด" : "ปิด";
        if (typeof RELAYS !== 'undefined') {
            RELAYS.forEach(relay => {
                if (window.mqttHandler) window.mqttHandler.publish(MQTT_CONFIG.topics.relaySet(relay), state ? "ON" : "OFF");
            });
        }
        showToast(`${action}อุปกรณ์ทั้งหมดแล้ว`, "success");
        addActivity(`${action}อุปกรณ์ทั้งหมด`, "relay");
    };
=======
    // ==================== RELAY STATE ====================
    function updateRelayState(relay, isOn) {
        // Update main toggles
        const toggles = [$(`${relay}Toggle`), $(`${relay}ToggleHome`)];
        toggles.forEach(t => { if (t) t.checked = isOn; });

        // Update status texts
        const texts = [$(`${relay}StatusText`), $(`${relay}StatusTextHome`)];
        texts.forEach(t => {
            if (t) {
                t.textContent = isOn ? "เปิด" : "ปิด";
                t.className = "text-[10px] " + (isOn ? "text-emerald-400 font-medium" : "text-[#8E8E93]");
            }
        });

        // Update cards
        const cards = [$(`card-${relay}`), $(`card-${relay}-home`)];
        cards.forEach(c => {
            if (c) {
                if (isOn) c.classList.add("active");
                else c.classList.remove("active");
            }
        });
    }
>>>>>>> cfe7be8 (Fix: Update Service Worker to v2 to clear stale login screen, and add interactive toggles to Home page for easier control)

    // ==================== REAL-TIME CLOCK ====================
    function startClock() {
        setInterval(() => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
            const dateStr = now.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-");
            const [h, m] = timeStr.split(":");
            const seconds = now.getSeconds();
            const blink = seconds % 2 === 0 ? "opacity-100" : "opacity-30";
            
            if ($("currentTime")) $("currentTime").innerHTML = `<span class="font-mono">${h}<span class="${blink} transition-opacity duration-500">:</span>${m}</span>`;
            if ($("currentDate")) $("currentDate").textContent = dateStr;
        }, 1000);
    }
    startClock();

    // ==================== INITIALIZATION ====================
    // Start MQTT
    if (window.mqttHandler) window.mqttHandler.connect();
    
    // Lucide icons
    if (window.lucide) lucide.createIcons();

    // Schedule logic
    let currentSchedTab = "pump";
    window.switchSchedTab = (relay) => {
        currentSchedTab = relay;
        document.querySelectorAll(".sched-tab-btn").forEach(btn => {
            btn.classList.toggle("sched-active", btn.dataset.tab === relay);
        });
    };

    window.saveSchedule = () => {
        const data = {
            enabled: $("schedEnable").checked,
            on: $("schedOn").value || "00:00",
            off: $("schedOff").value || "00:00"
        };
        if (window.mqttHandler && typeof MQTT_CONFIG !== 'undefined') {
            window.mqttHandler.publish(MQTT_CONFIG.topics.scheduleSet(currentSchedTab), JSON.stringify(data), { retain: true });
        }
        if (typeof RELAY_NAMES !== 'undefined') {
            showToast(`บันทึกตารางเวลา ${RELAY_NAMES[currentSchedTab]} แล้ว`, "success");
            addActivity(`ตั้งค่าตารางเวลา ${RELAY_NAMES[currentSchedTab]}`, "schedule");
        }
    };

<<<<<<< HEAD
=======
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
        const setupToggle = (id) => {
            const toggle = $(id);
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
        };
        setupToggle(`${relay}Toggle`);
        setupToggle(`${relay}ToggleHome`);
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

>>>>>>> cfe7be8 (Fix: Update Service Worker to v2 to clear stale login screen, and add interactive toggles to Home page for easier control)
    // ==================== DARK MODE ====================
    const darkModeBtn = $("darkModeBtn");
    if (darkModeBtn) {
        darkModeBtn.addEventListener("click", () => {
            document.documentElement.classList.toggle("dark");
            const isDark = document.documentElement.classList.contains("dark");
            darkModeBtn.innerHTML = isDark ? '<i data-lucide="sun" class="w-4 h-4 text-white"></i>' : '<i data-lucide="moon" class="w-4 h-4 text-white"></i>';
            if (window.lucide) lucide.createIcons();
            localStorage.setItem("darkMode", isDark ? "dark" : "light");
        });
    }

    // Load saved dark mode
    if (localStorage.getItem("darkMode") === "light") {
        document.documentElement.classList.remove("dark");
        if (darkModeBtn) darkModeBtn.innerHTML = '<i data-lucide="moon" class="w-4 h-4 text-white"></i>';
    } else {
        document.documentElement.classList.add("dark");
        if (darkModeBtn) darkModeBtn.innerHTML = '<i data-lucide="sun" class="w-4 h-4 text-white"></i>';
    }

    // ==================== PWA & SPLASH ====================
    const hideSplash = () => {
        const splash = $("splash-screen");
        if (splash) {
            splash.classList.add("fade-out");
            setTimeout(() => splash.style.display = "none", 500);
        }
    };

    if (document.readyState === "complete") {
        setTimeout(hideSplash, 1500);
    } else {
        window.addEventListener("load", () => setTimeout(hideSplash, 1500));
    }
});
