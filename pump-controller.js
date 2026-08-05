// Pump Controller - Synchronizes MQTT status with UI/Animations

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

        // Quick button listener (Home page)
        const quickBtn = document.getElementById('quickPumpBtn');
        if (quickBtn) {
            quickBtn.addEventListener('click', () => {
                const currentStatus = document.getElementById('pumpQuickStatus').textContent === 'เปิด';
                this.requestToggle(!currentStatus);
            });
        }
    }

    requestToggle(isOn) {
        // 1. Spring animation
        const card = document.getElementById('card-pump');
        window.animationController.playSpring(card);

        // 2. Set temporary state
        this.setState('connecting');
        
        // 3. Publish to MQTT
        window.mqttHandler.publish(MQTT_CONFIG.topics.relaySet('pump'), isOn ? 'ON' : 'OFF');

        // 4. Safety timeout: if no response from MQTT in 5 seconds, revert
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
        this.setState(isOn ? 'running' : 'idle');
        
        // Update toggle UI to match real status
        const toggle = document.getElementById('pumpToggle');
        if (toggle) toggle.checked = isOn;

        // Update Quick Status UI (Home page)
        const quickStatus = document.getElementById('pumpQuickStatus');
        const quickIconBg = document.getElementById('quickPumpIconBg');
        if (quickStatus) {
            quickStatus.textContent = isOn ? 'เปิด' : 'ปิด';
            quickStatus.className = `text-[9px] font-semibold ${isOn ? 'text-emerald-400' : 'text-[#8E8E93]'}`;
        }
        if (quickIconBg) {
            quickIconBg.className = `w-8 h-8 rounded-full flex items-center justify-center mb-1.5 transition-colors duration-300 ${isOn ? 'bg-emerald-500/20' : 'bg-[#007AFF]/20'}`;
            const icon = quickIconBg.querySelector('i');
            if (icon) icon.className = `w-4 h-4 ${isOn ? 'text-emerald-400' : 'text-[#007AFF]'}`;
        }

        // Handle runtime
        if (isOn) {
            this.startTimer();
        } else {
            this.stopTimer();
        }
        
        // Update last activated time
        if (isOn) {
            const now = new Date();
            document.getElementById('pumpLastTime').textContent = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        }
    }

    setState(state) {
        this.state = state;
        window.animationController.setPumpState(state);
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
            document.getElementById('pumpRuntime').textContent = `เวลาทำงาน: ${h}:${m}:${s}`;
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.runtimeInterval);
        this.runtimeInterval = null;
    }
}

window.pumpController = new PumpController();
