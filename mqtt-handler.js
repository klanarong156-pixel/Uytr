// MQTT Handler - Robust connection, subscribe-once, queueing, backoff, heartbeat

class MqttHandler {
    constructor(config){
        this.config = config;
        this.client = null;
        this.connected = false;
        this.subscribed = false;
        this.messageQueue = [];
        this.maxQueue = 200;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.backoffBase = 1000; // 1s
        this.backoffMax = 60000; // 60s
        this.heartbeatTimeout = 35000; // 35s to detect ESP offline
        this.espLastSeen = 0;
        this.espTimer = null;
        this._attached = false; // protect duplicate listeners
    }

    connect(){
        if (typeof mqtt === 'undefined'){
            console.error('MQTT library not loaded!');
            return;
        }

        // If already have a client and connected, do nothing
        if (this.client && this.connected) return;

        // If there's an existing client, ensure listeners removed and ended before new connect
        if (this.client){
            try{
                this.client.removeAllListeners && this.client.removeAllListeners();
                this.client.end && this.client.end(true);
            }catch(e){ console.warn('Error cleaning old client', e); }
            this.client = null;
        }

        const opts = {
            clientId: this.config.clientId,
            username: this.config.username,
            password: this.config.password,
            clean: true,
            reconnectPeriod: 0, // we'll manage backoff ourselves
            connectTimeout: 30 * 1000
        };

        const url = this.config.url;
        this.client = mqtt.connect(url, opts);

        // remove any stale listeners (defensive)
        if (this.client.removeAllListeners) this.client.removeAllListeners();

        this.client.on('connect', () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            this.dispatchEvent('mqtt:connected', true);
            console.info('MQTT connected');

            // subscribe to required topics exactly once per live client
            this.subscribeTopics();

            // flush queued messages
            this.flushQueue();
        });

        this.client.on('reconnect', () => {
            console.info('MQTT reconnect event');
        });

        this.client.on('close', () => {
            if (this.connected){
                this.connected = false;
                this.dispatchEvent('mqtt:connected', false);
            }
            // schedule reconnect with backoff
            this.scheduleReconnect();
        });

        this.client.on('offline', () => {
            console.warn('MQTT client offline');
            this.connected = false;
            this.dispatchEvent('mqtt:connected', false);
            this.scheduleReconnect();
        });

        this.client.on('error', (err) => {
            console.error('MQTT Error:', err);
            this.dispatchEvent('mqtt:error', err);
            // attempt reconnect
            this.scheduleReconnect();
        });

        // message handler
        this.client.on('message', (topic, message) => {
            const payload = (message || '').toString();
            this.handleMessage(topic, payload);
        });
    }

    scheduleReconnect(){
        if (this.reconnectTimer) return; // already scheduled
        this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 30);
        const delay = Math.min(this.backoffBase * Math.pow(2, this.reconnectAttempts - 1), this.backoffMax);
        console.info(`Scheduling MQTT reconnect in ${delay}ms`);
        this.reconnectTimer = setTimeout(()=>{
            this.reconnectTimer = null;
            try{ this.connect(); }catch(e){ console.error(e); }
        }, delay + Math.floor(Math.random()*300)); // small jitter
    }

    subscribeTopics(){
        if (!this.client || !this.client.connected) return;
        if (this.subscribed) return; // already subscribed for this client

        // Build topics we care about (keep topics unchanged)
        const topics = [
            // relay statuses
            this.config.topics.relayStatus('pump'),
            this.config.topics.relayStatus('zone1'),
            this.config.topics.relayStatus('lighthome'),
            this.config.topics.relayStatus('lightsala'),
            // esp online
            this.config.topics.online,
            // mode status
            this.config.topics.modeStatus,
            // sensors (optional)
            'smartfarm/sensor/#'
        ];

        try{
            // subscribe in one call
            this.client.subscribe(topics, { qos: 0 }, (err, granted) => {
                if (err){
                    console.error('Subscribe error', err);
                    return;
                }
                console.info('Subscribed to topics', granted || topics);
                this.subscribed = true;
            });
        }catch(e){ console.error('subscribeTopics failed', e); }
    }

    handleMessage(topic, payload){
        // Track ESP heartbeat
        if (topic === this.config.topics.online){
            this.espLastSeen = Date.now();
            // clear and set offline timer
            if (this.espTimer) clearTimeout(this.espTimer);
            this.espTimer = setTimeout(()=>{
                // if no heartbeat after timeout, dispatch offline
                this.dispatchEvent('esp:status', false);
            }, this.heartbeatTimeout + 200);
            // dispatch online immediately
            this.dispatchEvent('esp:status', payload === 'true');
            return this.dispatchEvent('mqtt:message', { topic, payload });
        }

        // Relay statuses
        if (topic.includes('relay/') && topic.endsWith('/status')){
            const relay = topic.split('/')[2];
            const status = (payload === 'ON');
            this.dispatchEvent('relay:status', { relay, status });
            return this.dispatchEvent('mqtt:message', { topic, payload });
        }

        // Mode
        if (topic === this.config.topics.modeStatus){
            this.dispatchEvent('mode:status', payload === 'AUTO');
            return this.dispatchEvent('mqtt:message', { topic, payload });
        }

        // Sensors
        if (topic.startsWith('smartfarm/sensor/')){
            try{
                const data = JSON.parse(payload);
                for (const [key, value] of Object.entries(data)){
                    this.dispatchEvent('sensor:data', { type: key, value: parseFloat(value) });
                }
            }catch(e){
                const type = topic.split('/')[2];
                this.dispatchEvent('sensor:data', { type, value: parseFloat(payload) });
            }
            return this.dispatchEvent('mqtt:message', { topic, payload });
        }

        // Generic
        this.dispatchEvent('mqtt:message', { topic, payload });
    }

    publish(topic, payload, options = {}){
        if (this.client && this.client.connected){
            try{
                this.client.publish(topic, payload, options, (err)=>{
                    if (err) console.error('Publish error', err);
                });
            }catch(e){ console.error('Publish threw', e); }
        } else {
            // queue message
            if (this.messageQueue.length >= this.maxQueue){
                // drop oldest
                this.messageQueue.shift();
            }
            this.messageQueue.push({ topic, payload, options });
            console.warn('MQTT not connected — queued message', topic, payload);
            // also attempt to connect if not scheduled
            if (!this.connected && !this.reconnectTimer){ this.scheduleReconnect(); }
        }
    }

    flushQueue(){
        if (!this.client || !this.client.connected) return;
        while(this.messageQueue.length){
            const m = this.messageQueue.shift();
            try{
                this.client.publish(m.topic, m.payload, m.options, (err)=>{ if (err) console.error('flush publish err', err); });
            }catch(e){ console.error('flush publish failed', e); }
        }
    }

    dispatchEvent(name, detail){
        const event = new CustomEvent(name, { detail });
        window.dispatchEvent(event);
    }
}

// Initialize global handler if not present
if (!window.mqttHandler){
    window.mqttHandler = new MqttHandler(MQTT_CONFIG);
}
