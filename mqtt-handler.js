// MQTT Handler - Manages connection and message dispatching

class MqttHandler {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.onMessageCallbacks = [];
    }

    connect() {
        console.log("Connecting to MQTT...");
        if (typeof mqtt === 'undefined') {
            console.error("MQTT library not loaded!");
            return;
        }
        const options = {
            clientId: this.config.clientId,
            username: this.config.username,
            password: this.config.password,
            clean: true,
            reconnectPeriod: 5000,
            connectTimeout: 30 * 1000
        };
        this.client = mqtt.connect(this.config.url, options);
        this.client.on('connect', () => {
            console.log("Connected to MQTT Broker");
            this.dispatchEvent('mqtt:connected', true);
            this.client.subscribe('smartfarm/#');
        });
        this.client.on('message', (topic, message) => this.handleMessage(topic, message.toString()));
        this.client.on('close', () => this.dispatchEvent('mqtt:connected', false));
        this.client.on('error', (err) => {
            console.error("MQTT Error:", err);
            this.dispatchEvent('mqtt:error', err);
        });
    }

    handleMessage(topic, payload) {
        if (topic.includes('relay/') && topic.endsWith('/status')) {
            const relay = topic.split('/')[2];
            this.dispatchEvent('relay:status', { relay, status: payload === 'ON' });
        } else if (topic === this.config.topics.online) {
            this.dispatchEvent('esp:status', payload === 'online');
        } else if (topic === this.config.topics.modeStatus) {
            this.dispatchEvent('mode:status', payload === 'AUTO');
        } else if (topic.startsWith('smartfarm/sensor/')) {
            const type = topic.split('/')[2];
            this.dispatchEvent('sensor:data', { type, value: parseFloat(payload) });
        } else if (topic.startsWith('smartfarm/schedule/') && topic.endsWith('/status')) {
            const relay = topic.split('/')[2];
            this.dispatchEvent('schedule:status', { relay, payload });
        }
        this.dispatchEvent('mqtt:message', { topic, payload });
    }

    publish(topic, payload, options = {}) {
        if (this.client && this.client.connected) {
            this.client.publish(topic, payload, options);
        } else {
            console.warn("Cannot publish, MQTT not connected");
        }
    }

    dispatchEvent(name, detail) {
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }
}

window.mqttHandler = new MqttHandler(MQTT_CONFIG);

// ==================== SMARTFARM V5.2 DASHBOARD PATCH ====================
(function () {
    const RELAYS = ['pump', 'zone1', 'lighthome', 'lightsala'];
    const NAMES = { pump:'ปั๊มน้ำ', zone1:'โซน 1', lighthome:'ไฟบ้าน', lightsala:'ไฟศาลา' };
    let currentTab = 'pump';
    const schedules = {};
    RELAYS.forEach(r => schedules[r] = {enabled:false,on:'00:00',off:'00:00'});

    function publishRelay(relay, on) {
        window.mqttHandler.publish(MQTT_CONFIG.topics.relaySet(relay), on ? 'ON' : 'OFF');
    }

    function setRelayUI(relay, on) {
        if (window.APP_STATE && APP_STATE.relays) APP_STATE.relays[relay] = !!on;
        const toggle = document.getElementById(relay + 'Toggle');
        if (toggle) toggle.checked = !!on;
        const quick = document.getElementById(relay === 'pump' ? 'pumpQuickStatus' : relay + 'QuickStatus');
        if (quick) quick.textContent = on ? 'เปิด' : 'ปิด';
        const status = document.getElementById(relay + 'StatusText');
        if (status) status.textContent = on ? 'กำลังทำงาน' : 'ปิด';
        if (relay === 'pump') {
            const p = document.getElementById('pumpStatusText');
            if (p) p.textContent = on ? 'กำลังสูบน้ำ' : 'หยุดรดน้ำ';
        }
    }

    function renderSchedule(relay) {
        const s = schedules[relay];
        const e = document.getElementById('schedEnable');
        const on = document.getElementById('schedOn');
        const off = document.getElementById('schedOff');
        const summary = document.getElementById('schedSummary');
        if (e) e.checked = !!s.enabled;
        if (on) on.value = s.on;
        if (off) off.value = s.off;
        if (summary) summary.textContent = s.enabled ? `${NAMES[relay]}: ${s.on} - ${s.off}` : `${NAMES[relay]}: ยังไม่เปิดใช้งานตารางเวลา`;
    }

    window.currentSchedTab = 'pump';
    window.switchSchedTab = function (relay) {
        if (!RELAYS.includes(relay)) return;
        currentTab = relay;
        window.currentSchedTab = relay;
        document.querySelectorAll('.sched-tab-btn').forEach(b => b.classList.toggle('sched-active', b.dataset.tab === relay));
        renderSchedule(relay);
    };

    window.saveSchedule = function () {
        const enabled = !!document.getElementById('schedEnable')?.checked;
        const on = document.getElementById('schedOn')?.value || '00:00';
        const off = document.getElementById('schedOff')?.value || '00:00';
        if (on === off) { window.showToast?.('เวลาเปิดและเวลาปิดต้องไม่เท่ากัน', 'warning'); return; }
        schedules[currentTab] = {enabled,on,off};
        window.mqttHandler.publish(MQTT_CONFIG.topics.scheduleSet(currentTab), JSON.stringify(schedules[currentTab]), {retain:true});
        window.showToast?.(`บันทึกตารางเวลา ${NAMES[currentTab]} แล้ว`, 'success');
    };

    window.deleteSchedule = function () {
        schedules[currentTab] = {enabled:false,on:'00:00',off:'00:00'};
        window.mqttHandler.publish(MQTT_CONFIG.topics.scheduleSet(currentTab), 'DELETE');
        renderSchedule(currentTab);
        window.showToast?.(`ลบตารางเวลา ${NAMES[currentTab]} แล้ว`, 'success');
    };

    function bindToggle(relay) {
        const el = document.getElementById(relay + 'Toggle');
        if (!el || el.dataset.v52Bound) return;
        el.dataset.v52Bound = '1';
        el.addEventListener('change', () => publishRelay(relay, el.checked));
    }

    function bindPumpButton() {
        const el = document.getElementById('quickPumpBtn');
        if (!el || el.dataset.v52Bound) return;
        el.dataset.v52Bound = '1';
        el.addEventListener('click', () => publishRelay('pump', !(window.APP_STATE?.relays?.pump)));
    }

    function bindMode() {
        const manual = document.getElementById('manualModeBtn');
        const auto = document.getElementById('autoModeBtn');
        if (manual && !manual.dataset.v52Bound) { manual.dataset.v52Bound='1'; manual.addEventListener('click',()=>window.mqttHandler.publish(MQTT_CONFIG.topics.modeSet,'MANUAL')); }
        if (auto && !auto.dataset.v52Bound) { auto.dataset.v52Bound='1'; auto.addEventListener('click',()=>window.mqttHandler.publish(MQTT_CONFIG.topics.modeSet,'AUTO')); }
    }

    window.addEventListener('relay:status', e => setRelayUI(e.detail.relay, e.detail.status));
    window.addEventListener('schedule:status', e => {
        if (!schedules[e.detail.relay]) return;
        try {
            const x=JSON.parse(e.detail.payload);
            schedules[e.detail.relay]={enabled:!!x.enabled,on:x.on||'00:00',off:x.off||'00:00'};
            if(e.detail.relay===currentTab) renderSchedule(currentTab);
        } catch(_) {}
    });
    window.addEventListener('mode:status', e => {
        const auto=!!e.detail;
        document.getElementById('manualModeBtn')?.classList.toggle('active-mode',!auto);
        document.getElementById('autoModeBtn')?.classList.toggle('active-mode',auto);
        const mode=document.getElementById('currentMode'); if(mode) mode.textContent=auto?'Auto Mode':'Manual Mode';
    });

    function bindAll() { RELAYS.forEach(bindToggle); bindPumpButton(); bindMode(); renderSchedule(currentTab); }
    document.addEventListener('DOMContentLoaded', () => setTimeout(bindAll, 50));
    window.addEventListener('load', bindAll);
})();
