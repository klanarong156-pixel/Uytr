// MQTT Handler - Manages connection and message dispatching

class MqttHandler {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.onMessageCallbacks = [];
    }

    connect() {
        console.log("Connecting to MQTT...");
        
        // Using Paho or MQTT.js (assuming MQTT.js is available via CDN or existing script)
        // Based on script.js, it seems to use mqtt.connect
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
            
            // Subscribe to all necessary topics
            this.client.subscribe('smartfarm/#');
        });

        this.client.on('message', (topic, message) => {
            const payload = message.toString();
            this.handleMessage(topic, payload);
        });

        this.client.on('close', () => {
            this.dispatchEvent('mqtt:connected', false);
        });

        this.client.on('error', (err) => {
            console.error("MQTT Error:", err);
            this.dispatchEvent('mqtt:error', err);
        });
    }

    handleMessage(topic, payload) {
        // Dispatch specific events based on topic
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
        }
        
        // Generic message event
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
        const event = new CustomEvent(name, { detail });
        window.dispatchEvent(event);
    }
}

// Initialize global handler
window.mqttHandler = new MqttHandler(MQTT_CONFIG);
