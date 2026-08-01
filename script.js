document.addEventListener('DOMContentLoaded', () => {
    const espStatusElement = document.getElementById('espStatus');
    const temperatureElement = document.getElementById('temperature');
    const humidityElement = document.getElementById('humidity');
    const currentTimeElement = document.getElementById('currentTime');
    const mqttStatusElement = document.getElementById('mqttStatus');

    const pumpToggleBtn = document.getElementById('pumpToggle');
    const zone1ToggleBtn = document.getElementById('zone1Toggle');
    const lightHomeToggleBtn = document.getElementById('lightHomeToggle');
    const lightSalaToggleBtn = document.getElementById('lightSalaToggle');

    const manualModeBtn = document.getElementById('manualModeBtn');
    const autoModeBtn = document.getElementById('autoModeBtn');
    const currentModeElement = document.getElementById('currentMode');

    const pumpScheduleEnable = document.getElementById('pumpScheduleEnable');
    const pumpOnInput = document.getElementById('pumpOnInput');
    const pumpOffInput = document.getElementById('pumpOffInput');
    const saveSchedulesBtn = document.getElementById('saveSchedulesBtn');

    // Function to update UI based on MQTT messages
    function updateUI(topic, message) {
        switch (topic) {
            case 'smartfarm/status/online':
                espStatusElement.textContent = (message === 'true') ? 'Online' : 'Offline';
                espStatusElement.style.color = (message === 'true') ? 'green' : 'red';
                break;
            case 'smartfarm/sensor/dht11':
                try {
                    const data = JSON.parse(message);
                    temperatureElement.textContent = data.temperature;
                    humidityElement.textContent = data.humidity;
                } catch (e) {
                    console.error('Error parsing DHT11 data:', e);
                }
                break;
            case 'smartfarm/time':
                currentTimeElement.textContent = message;
                break;
            case 'smartfarm/mqtt/status': // Assuming the ESP publishes its MQTT connection status
                mqttStatusElement.textContent = message;
                mqttStatusElement.style.color = (message === 'Connected') ? 'green' : 'red';
                break;
            case 'smartfarm/relay/pump/status':
                pumpToggleBtn.textContent = message;
                pumpToggleBtn.classList.toggle('active', message === 'ON');
                break;
            case 'smartfarm/relay/zone1/status':
                zone1ToggleBtn.textContent = message;
                zone1ToggleBtn.classList.toggle('active', message === 'ON');
                break;
            case 'smartfarm/relay/lighthome/status':
                lightHomeToggleBtn.textContent = message;
                lightHomeToggleBtn.classList.toggle('active', message === 'ON');
                break;
            case 'smartfarm/relay/lightsala/status':
                lightSalaToggleBtn.textContent = message;
                lightSalaToggleBtn.classList.toggle('active', message === 'ON');
                break;
            case 'smartfarm/mode/status':
                currentModeElement.textContent = message;
                break;
            case 'smartfarm/schedule/pump/status':
                try {
                    const schedule = JSON.parse(message);
                    pumpScheduleEnable.checked = schedule.enabled;
                    pumpOnInput.value = schedule.on;
                    pumpOffInput.value = schedule.off;
                } catch (e) {
                    console.error('Error parsing pump schedule data:', e);
                }
                break;
            // Add cases for other relay schedules
        }
    }

    // Placeholder for MQTT connection (this would typically be handled by a WebSocket to MQTT bridge or direct MQTT over WebSockets)
    // For this example, we'll simulate updates or assume the ESP's web server provides an API to get current states.
    // In a real scenario, you'd use a library like Paho MQTT JavaScript client.

    // Simulate MQTT updates for demonstration purposes
    let simulatedEspOnline = true;
    let simulatedPumpStatus = 'OFF';
    let simulatedMode = 'MANUAL';

    setInterval(() => {
        // Simulate ESP status
        simulatedEspOnline = !simulatedEspOnline;
        updateUI('smartfarm/status/online', simulatedEspOnline ? 'true' : 'false');
        updateUI('smartfarm/mqtt/status', 'Connected'); // Assume connected if ESP is online

        // Simulate sensor data
        const temp = (Math.random() * 10 + 25).toFixed(1); // 25-35 C
        const hum = (Math.random() * 20 + 60).toFixed(1); // 60-80 %
        updateUI('smartfarm/sensor/dht11', JSON.stringify({ temperature: temp, humidity: hum }));

        // Simulate time
        const now = new Date();
        const timeString = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        updateUI('smartfarm/time', timeString);

        // Simulate relay status
        updateUI('smartfarm/relay/pump/status', simulatedPumpStatus);
        updateUI('smartfarm/mode/status', simulatedMode);

    }, 5000); // Update every 5 seconds

    // Event listeners for relay buttons
    pumpToggleBtn.addEventListener('click', () => {
        simulatedPumpStatus = (simulatedPumpStatus === 'ON') ? 'OFF' : 'ON';
        // In a real app, send MQTT command: client.publish('smartfarm/relay/pump/set', simulatedPumpStatus);
        updateUI('smartfarm/relay/pump/status', simulatedPumpStatus);
    });
    // Add event listeners for other relay buttons

    // Event listeners for mode buttons
    manualModeBtn.addEventListener('click', () => {
        simulatedMode = 'MANUAL';
        // In a real app, send MQTT command: client.publish('smartfarm/mode/set', 'MANUAL');
        updateUI('smartfarm/mode/status', 'MANUAL');
    });

    autoModeBtn.addEventListener('click', () => {
        simulatedMode = 'AUTO';
        // In a real app, send MQTT command: client.publish('smartfarm/mode/set', 'AUTO');
        updateUI('smartfarm/mode/status', 'AUTO');
    });

    // Event listener for save schedules button
    saveSchedulesBtn.addEventListener('click', () => {
        const pumpSchedule = {
            enabled: pumpScheduleEnable.checked,
            on: pumpOnInput.value,
            off: pumpOffInput.value
        };
        // In a real app, send MQTT command: client.publish('smartfarm/schedule/pump/set', JSON.stringify(pumpSchedule));
        console.log('Saving pump schedule:', pumpSchedule);
        alert('บันทึกการตั้งค่าเรียบร้อยแล้ว (Simulated)');
    });

    // Initial UI update (can be fetched from ESP on page load)
    updateUI('smartfarm/status/online', 'false');
    updateUI('smartfarm/mqtt/status', 'Disconnected');
    updateUI('smartfarm/relay/pump/status', 'OFF');
    updateUI('smartfarm/mode/status', 'MANUAL');
});
