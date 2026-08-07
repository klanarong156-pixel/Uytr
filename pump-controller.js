// Pump Controller - Synchronizes MQTT status with UI (animations removed)

class PumpController {
    constructor() {
        this.state = 'idle'; // idle, connecting, running, error
        this.lastMqttUpdate = Date.now();
        this.runtimeInterval = null;
        this.startTime = null;
        
        this.initListeners();
    }

    initListeners() {
        window.addEventListener('relay:status', (e) => {
            if (e.detail.relay === 'pump') {
                this.handleStatusUpdate(e.detail.status);
            }
        });

        window.addEventListener('mqtt:connected', (e) => {
            const badge = document.getElementById('pump-mqtt-badge');
            if (badge) {
                badge.className = `status-badge ${e.detail ? 'badge-mqtt-online' : 'badge-mqtt-offline'}`;
            }
        });

        window.addEventListener('mode:status', (e) => {
            const badge = document.getElementById('pump-mode-badge');
            if (badge) {
                badge.className = `status-badge ${e.detail ? 'badge-mode-auto' : 'badge-mode-manual'}`;
                badge.textContent = e.detail ? 'Auto' : 'Manual';
            }
        });

        // Toggle listener
        const toggle = document.getElementById('pumpToggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                this.requestToggle(e.target.checked);
            });
        }
    }

    requestToggle(isOn) {
        // Set temporary state (static, no animation)
        this.setState('connecting');
        
        // Publish to MQTT (unchanged)
        window.mqttHandler.publish(MQTT_CONFIG.topics.relaySet('pump'), isOn ? 'ON' : 'OFF');

        // Safety timeout: if no response from MQTT in 5 seconds, revert
        clearTimeout(this.safetyTimeout);
        this.safetyTimeout = setTimeout(() => {
            if (this.state === 'connecting') {
                console.warn("MQTT Timeout for Pump");
                this.setState('error');
                setTimeout(() => this.revertUI(), 2000);
            }
        }, 5000);
    }

    handleStatusUpdate(isOn) {
        clearTimeout(this.safetyTimeout);
        
        // Update APP_STATE
        if (typeof APP_STATE !== 'undefined') {
            APP_STATE.relays.pump = isOn;
        }

        this.setState(isOn ? 'running' : 'idle');
        
        // Update toggle UI to match real status
        const toggle = document.getElementById('pumpToggle');
        if (toggle) toggle.checked = isOn;

        // Handle runtime
        if (isOn) {
            this.startTimer();
        } else {
            this.stopTimer();
        }
        
        // Update last activated time
        if (isOn) {
            const now = new Date();
            const timeEl = document.getElementById('pumpLastTime');
            if (timeEl) timeEl.textContent = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        }
    }

    setState(state) {
        this.state = state;
        // Update static UI state without any animations
        const statusText = document.getElementById('pumpStatusText');
        const iconBg = document.getElementById('pump-icon-bg');

        if (statusText) {
            if (state === 'running') statusText.textContent = 'กำลังรดน้ำ...';
            else if (state === 'connecting') statusText.textContent = 'กำลังเชื่อมต่อ...';
            else if (state === 'error') statusText.textContent = 'ข้อผิดพลาด!';
            else statusText.textContent = 'หยุดรดน้ำ';
        }

        if (iconBg) {
            if (state === 'running') iconBg.style.backgroundColor = '#3B82F6';
            else if (state === 'connecting') iconBg.style.backgroundColor = '#F59E0B';
            else if (state === 'error') iconBg.style.backgroundColor = '#EF4444';
            else iconBg.style.backgroundColor = '';
        }
    }

    revertUI() {
        // Revert to last known state from APP_STATE or similar
        const lastStatus = APP_STATE.relays.pump;
        this.handleStatusUpdate(lastStatus);
    }

    startTimer() {
        if (this.runtimeInterval) return;
        this.startTime = Date.now();
        this.runtimeInterval = setInterval(() => {
            const diff = Date.now() - this.startTime;
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            const el = document.getElementById('pumpRuntime');
            if (el) el.textContent = `เวลาทำงาน: ${h}:${m}:${s}`;
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.runtimeInterval);
        this.runtimeInterval = null;
    }
}

window.pumpController = new PumpController();
