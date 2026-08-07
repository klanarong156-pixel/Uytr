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
            document.getElementById("page-" + page).classList.add("active");
        });
    });

    // ==================== SETTINGS MODAL ====================
    document.getElementById("settingsBtn").addEventListener("click", () => {
        document.getElementById("settingsModal").classList.add("show");
    });

    window.closeSettingsModal = () => {
        document.getElementById("settingsModal").classList.remove("show");
    };

    window.applyMqttSettings = () => {
        MQTT_CONFIG.url = $("mqttUrl").value;
        MQTT_CONFIG.username = $("mqttUser").value;
        MQTT_CONFIG.password = $("mqttPass").value;
        showToast("บันทึกการตั้งค่า MQTT แล้ว กำลังเชื่อมต่อใหม่...", "info");
        closeSettingsModal();
        window.mqttHandler.connect();
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

    // ==================== ALL RELAYS ====================
    window.allRelays = (state) => {
        const action = state ? "เปิด" : "ปิด";
        RELAYS.forEach(relay => {
            window.mqttHandler.publish(MQTT_CONFIG.topics.relaySet(relay), state ? "ON" : "OFF");
        });
        showToast(`${action}อุปกรณ์ทั้งหมดแล้ว`, "success");
        addActivity(`${action}อุปกรณ์ทั้งหมด`, "relay");
    };

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
    window.mqttHandler.connect();
    
    // Lucide icons
    if (window.lucide) lucide.createIcons();

    // Schedule logic (simplified for now, keeping existing functionality)
    let currentSchedTab = "pump";
    window.switchSchedTab = (relay) => {
        currentSchedTab = relay;
        document.querySelectorAll(".sched-tab-btn").forEach(btn => {
            btn.classList.toggle("sched-active", btn.dataset.tab === relay);
        });
        // In a real app, we'd fetch current schedule data here
    };

    window.saveSchedule = () => {
        const data = {
            enabled: $("schedEnable").checked,
            on: $("schedOn").value || "00:00",
            off: $("schedOff").value || "00:00"
        };
        window.mqttHandler.publish(MQTT_CONFIG.topics.scheduleSet(currentSchedTab), JSON.stringify(data), { retain: true });
        showToast(`บันทึกตารางเวลา ${RELAY_NAMES[currentSchedTab]} แล้ว`, "success");
        addActivity(`ตั้งค่าตารางเวลา ${RELAY_NAMES[currentSchedTab]}`, "schedule");
    };
});

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
    window.addEventListener('load', () => {
        const splash = $("splash-screen");
        if (splash) {
            setTimeout(() => {
                splash.classList.add("fade-out");
                setTimeout(() => splash.style.display = "none", 500);
            }, 1500);
        }
    });
