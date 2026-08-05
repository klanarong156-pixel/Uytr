// UI Controller - Manages general dashboard UI and sensors

class UiController {
    constructor() {
        this.initEventListeners();
    }

    initEventListeners() {
        window.addEventListener('sensor:data', (e) => {
            this.updateSensor(e.detail.type, e.detail.value);
        });

        window.addEventListener('relay:status', (e) => {
            if (e.detail.relay !== 'pump') {
                this.updateRelayUI(e.detail.relay, e.detail.status);
            }
        });

        window.addEventListener('esp:status', (e) => {
            this.updateEspStatus(e.detail);
        });

        // Mode buttons
        const manualBtn = document.getElementById('manualModeBtn');
        const autoBtn = document.getElementById('autoModeBtn');

        if (manualBtn) {
            manualBtn.addEventListener('click', () => this.requestMode('MANUAL'));
        }
        if (autoBtn) {
            autoBtn.addEventListener('click', () => this.requestMode('AUTO'));
        }
    }

    updateSensor(type, value) {
        const id = type === 'temperature' ? 'temperature' : 'humidity';
        const el = document.getElementById(id);
        
        // Update APP_STATE
        if (typeof APP_STATE !== 'undefined' && APP_STATE.sensors) {
            APP_STATE.sensors[type] = value;
        }

        if (el) {
            el.textContent = value.toFixed(1);
            
            // Update bars
            const barId = type === 'temperature' ? 'tempBar' : 'humBar';
            const bar = document.getElementById(barId)?.querySelector('div');
            if (bar) {
                const pct = type === 'temperature' 
                    ? Math.min(100, Math.max(0, ((value + 10) / 60) * 100))
                    : Math.min(100, value);
                bar.style.width = `${pct}%`;
            }

            // Update time
            const timeEl = document.getElementById(type === 'temperature' ? 'tempTime' : 'humTime');
            if (timeEl) {
                const now = new Date();
                timeEl.textContent = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            }
        }
    }

    updateRelayUI(relay, isOn) {
        // Update APP_STATE
        if (typeof APP_STATE !== 'undefined') {
            APP_STATE.relays[relay] = isOn;
        }

        const toggle = document.getElementById(`${relay}Toggle`);
        const text = document.getElementById(`${relay}StatusText`);
        const card = document.getElementById(`card-${relay}`);
        const quick = document.getElementById(`${relay}QuickStatus`);

        if (toggle) toggle.checked = isOn;
        if (text) {
            text.textContent = isOn ? "เปิด" : "ปิด";
            text.className = `text-[10px] ${isOn ? 'text-emerald-400 font-medium' : 'text-[#8E8E93]'}`;
        }
        if (card) {
            isOn ? card.classList.add('active') : card.classList.remove('active');
        }
        if (quick) {
            quick.textContent = isOn ? "เปิด" : "ปิด";
            quick.className = `text-[9px] font-semibold ${isOn ? 'text-emerald-400' : 'text-[#8E8E93]'}`;
        }
    }

    updateEspStatus(isOnline) {
        const dot = document.getElementById('espDot');
        const text = document.getElementById('espStatus');
        if (dot && text) {
            dot.className = `w-2 h-2 rounded-full pulse-dot ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`;
            text.textContent = isOnline ? 'Online' : 'Offline';
            text.className = `text-[10px] font-semibold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`;
        }
    }

    requestMode(mode) {
        window.mqttHandler.publish(MQTT_CONFIG.topics.modeSet, mode);
    }
}

window.uiController = new UiController();
