// Core script - minimal edits to remove animationController usage

const $ = id => document.getElementById(id);

// ... other code above remains unchanged in repository; this file patch only ensures no animationController calls remain

// Assume dom object exists earlier in file; safe, minimal function replacements below

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
        // animationController removed — static updates only
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
        }
    });
}

