// Smart Farm Dashboard - Main Logic (UI & Coordination)

(function(){
    // Utility: safe getElement
    const $ = id => document.getElementById(id);

    // Debounce helper
    function debounce(fn, wait){
        let t;
        return function(...args){
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    // Ensure we only initialize once
    if (window.__ui_initialized) return;
    window.__ui_initialized = true;

    document.addEventListener("DOMContentLoaded", () => {
        // Cache DOM references
        const dom = {
            connDot: $('connDot'),
            connText: $('connText'),
            wifiStatusText: $('wifiStatusText'),
            espDot: $('espDot'),
            espStatus: $('espStatus'),
            pumpCard: $('card-pump'),
            pumpToggle: $('pumpToggle'),
            pumpStatusText: $('pumpStatusText'),
            pumpLastTime: $('pumpLastTime'),
            pumpQuickStatus: $('pumpQuickStatus'),
            zone1Toggle: $('zone1Toggle'),
            lighthomeToggle: $('lighthomeToggle'),
            lightsalaToggle: $('lightsalaToggle'),
            zone1StatusText: $('zone1StatusText'),
            lighthomeStatusText: $('lighthomeStatusText'),
            lightsalaStatusText: $('lightsalaStatusText'),
            connTextHeader: $('connTextHeader'),
            connDotHeader: $('connDotHeader')
        };

        // Guard missing DOM (graceful)
        Object.keys(dom).forEach(k => { if (!dom[k]) dom[k] = null; });

        // Small helper to format time
        function timeNow(){
            const d = new Date();
            return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // Update quick status UI
        function updateQuickStatus(relay, on){
            const map = {
                pump: dom.pumpQuickStatus,
                zone1: $('zone1QuickStatus'),
                lighthome: $('lighthomeQuickStatus'),
                lightsala: $('lightsalaQuickStatus')
            };
            const el = map[relay];
            if (!el) return;
            el.textContent = on ? 'เปิด' : 'ปิด';
            el.className = on ? 'text-[9px] text-emerald-400 font-semibold' : 'text-[9px] text-[#8E8E93] font-semibold';
        }

        // Central UI updater (debounced) to avoid DOM thrashing
        const applyRelayUi = debounce((relay, status) => {
            // Update APP_STATE
            APP_STATE.relays[relay] = !!status;

            // Pump
            if (relay === 'pump'){
                if (dom.pumpToggle) dom.pumpToggle.checked = status;
                if (dom.pumpStatusText) dom.pumpStatusText.textContent = status ? 'กำลังรดน้ำ...' : 'หยุดรดน้ำ';
                if (dom.pumpLastTime) dom.pumpLastTime.textContent = timeNow();
                updateQuickStatus('pump', status);
                // trigger animation controller if available
                if (window.animationController && typeof window.animationController.setPumpState === 'function'){
                    window.animationController.setPumpState(status ? 'running' : 'idle');
                }
            }

            // Zone1
            if (relay === 'zone1'){
                if (dom.zone1Toggle) dom.zone1Toggle.checked = status;
                if (dom.zone1StatusText) dom.zone1StatusText.textContent = status ? 'เปิด' : 'ปิด';
                updateQuickStatus('zone1', status);
            }

            // Light home
            if (relay === 'lighthome'){
                if (dom.lighthomeToggle) dom.lighthomeToggle.checked = status;
                if (dom.lighthomeStatusText) dom.lighthomeStatusText.textContent = status ? 'เปิด' : 'ปิด';
                updateQuickStatus('lighthome', status);
            }

            // Light sala
            if (relay === 'lightsala'){
                if (dom.lightsalaToggle) dom.lightsalaToggle.checked = status;
                if (dom.lightsalaStatusText) dom.lightsalaStatusText.textContent = status ? 'เปิด' : 'ปิด';
                updateQuickStatus('lightsala', status);
            }

        }, 80);

        // Attach toggle handlers (publish commands)
        function attachToggle(id, relay){
            const el = $(id);
            if (!el) return;
            // avoid duplicate listeners
            if (el.__bound) return;
            el.__bound = true;

            el.addEventListener('change', (e) => {
                const on = e.target.checked;
                // Publish ON/OFF preserving topics
                if (window.mqttHandler && MQTT_CONFIG){
                    const topic = MQTT_CONFIG.topics.relaySet(relay);
                    const payload = on ? 'ON' : 'OFF';
                    window.mqttHandler.publish(topic, payload);
                    addActivity(`${on ? 'สั่งเปิด' : 'สั่งปิด'} ${RELAY_NAMES[relay]}`, 'relay');
                    // reflect immediately for snappy UI; real state will come from device status
                    applyRelayUi(relay, on);
                } else {
                    showToast('MQTT ยังไม่เชื่อมต่อ', 'warning');
                    // revert toggle if not connected
                    setTimeout(() => { el.checked = !on; }, 200);
                }
            });
        }

        attachToggle('pumpToggle', 'pump');
        attachToggle('zone1Toggle', 'zone1');
        attachToggle('lighthomeToggle', 'lighthome');
        attachToggle('lightsalaToggle', 'lightsala');

        // ==================== MQTT EVENT HANDLERS ====================
        // Relay status updates from mqtt-handler -> dispatchEvent('relay:status', { relay, status })
        function onRelayStatus(e){
            try{
                const { relay, status } = e.detail;
                if (!relay) return;
                applyRelayUi(relay, !!status);
            } catch(err){ console.error(err); }
        }

        // ESP online/offline handling with timeout
        let espTimeout = null;
        function onEspStatus(e){
            const online = !!e.detail;
            APP_STATE.espOnline = online;
            if (dom.espDot) dom.espDot.className = `w-2 h-2 rounded-full pulse-dot bg-${online ? 'emerald' : 'rose'}-400`;
            if (dom.espStatus) { dom.espStatus.textContent = online ? 'Online' : 'Offline'; dom.espStatus.className = `text-[10px] font-semibold text-${online ? 'emerald' : 'rose'}-400`; }

            if (online){
                addActivity('ESP online', 'connection');
                // reset timeout: expect next heartbeat in 35s
                if (espTimeout) clearTimeout(espTimeout);
                espTimeout = setTimeout(()=>{
                    APP_STATE.espOnline = false;
                    if (dom.espDot) dom.espDot.className = `w-2 h-2 rounded-full pulse-dot bg-rose-400`;
                    if (dom.espStatus) { dom.espStatus.textContent = 'Offline'; dom.espStatus.className = 'text-[10px] font-semibold text-rose-400'; }
                    addActivity('ESP heartbeat lost', 'error');
                }, 35000);
            } else {
                addActivity('ESP offline', 'error');
            }
        }

        // MQTT connection status (handled elsewhere too)
        function onMqttConnected(e){
            const connected = !!e.detail;
            APP_STATE.mqttConnected = connected;
            if (dom.connDot) dom.connDot.className = `w-2 h-2 rounded-full pulse-dot bg-${connected ? 'emerald' : 'rose'}-400`;
            if (dom.connText) { dom.connText.textContent = connected ? 'เชื่อมต่อแล้ว' : 'ขาดการเชื่อมต่อ'; dom.connText.className = `text-[10px] font-semibold text-${connected ? 'emerald' : 'rose'}-400`; }
            if (dom.connDotHeader) dom.connDotHeader.className = `w-2 h-2 rounded-full pulse-dot bg-${connected ? 'emerald' : 'rose'}-400`;
            if (dom.connTextHeader) dom.connTextHeader.textContent = connected ? 'Connected' : 'Disconnected';

            if (connected){
                showToast('เชื่อมต่อ MQTT สำเร็จ', 'success');
            } else {
                showToast('ขาดการเชื่อมต่อ MQTT', 'error');
            }
        }

        // Subscribe once to window events (prevent duplicates)
        if (!window.__mqtt_ui_listeners_attached){
            window.addEventListener('relay:status', onRelayStatus);
            window.addEventListener('esp:status', onEspStatus);
            window.addEventListener('mqtt:connected', onMqttConnected);
            window.__mqtt_ui_listeners_attached = true;
        }

        // Start clock (already present elsewhere, keep but ensure single interval)
        if (!window.__clock_started){
            function startClock(){
                setInterval(() => {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
                    const dateStr = now.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-");
                    const [h, m] = timeStr.split(":");
                    const seconds = now.getSeconds();
                    const blink = seconds % 2 === 0 ? "opacity-100" : "opacity-30";
                    const ct = $('currentTime'); if (ct) ct.innerHTML = `<span class="font-mono">${h}<span class="${blink} transition-opacity duration-500">:</span>${m}</span>`;
                    const cd = $('currentDate'); if (cd) cd.textContent = dateStr;
                }, 1000);
            }
            startClock();
            window.__clock_started = true;
        }

        // Initialization: request mqttHandler to connect (mqtt-handler will handle reconnection logic)
        if (window.mqttHandler && typeof window.mqttHandler.connect === 'function'){
            // small delay to ensure events are attached
            setTimeout(()=> window.mqttHandler.connect(), 50);
        }

        // Lucide icons
        if (window.lucide) lucide.createIcons();

        // Attach schedule tab buttons
        document.querySelectorAll('.sched-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sched-tab-btn').forEach(b => b.classList.remove('sched-active'));
                btn.classList.add('sched-active');
                const relay = btn.dataset.tab;
                window.switchSchedTab && window.switchSchedTab(relay);
            });
        });

        // Mode buttons
        const manualBtn = $('manualModeBtn');
        const autoBtn = $('autoModeBtn');
        if (manualBtn && autoBtn){
            manualBtn.addEventListener('click', ()=>{
                APP_STATE.mode = 'manual';
                manualBtn.classList.add('active-mode'); autoBtn.classList.remove('active-mode');
                window.mqttHandler && window.mqttHandler.publish && window.mqttHandler.publish(MQTT_CONFIG.topics.modeSet, 'MANUAL');
            });
            autoBtn.addEventListener('click', ()=>{
                APP_STATE.mode = 'auto';
                autoBtn.classList.add('active-mode'); manualBtn.classList.remove('active-mode');
                window.mqttHandler && window.mqttHandler.publish && window.mqttHandler.publish(MQTT_CONFIG.topics.modeSet, 'AUTO');
            });
        }

    }); // DOMContentLoaded
})();
