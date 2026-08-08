// SmartFarm V5.2 Production MQTT Handler
class MqttHandler {
    constructor(config){this.config=config;this.client=null;this.connecting=false;}
    connect(){
        if(this.client?.connected||this.connecting)return;
        if(typeof mqtt==='undefined'){console.error('MQTT library not loaded');return;}
        this.connecting=true;
        this.client=mqtt.connect(this.config.url,{clientId:this.config.clientId,username:this.config.username,password:this.config.password,clean:true,reconnectPeriod:5000,connectTimeout:30000});
        this.client.on('connect',()=>{this.connecting=false;APP_STATE.mqttConnected=true;this.dispatch('mqtt:connected',true);this.client.subscribe('smartfarm/#');});
        this.client.on('message',(topic,message)=>this.handleMessage(topic,message.toString()));
        this.client.on('close',()=>{this.connecting=false;APP_STATE.mqttConnected=false;this.dispatch('mqtt:connected',false);});
        this.client.on('error',err=>{this.connecting=false;console.error('MQTT error',err);this.dispatch('mqtt:error',err);});
    }
    publish(topic,payload,options={}){if(this.client?.connected)this.client.publish(topic,String(payload),options);else console.warn('MQTT not connected:',topic);}
    handleMessage(topic,payload){
        const relay=topic.match(/^smartfarm\/relay\/(pump|zone1|lighthome|lightsala)\/status$/);
        if(relay){this.dispatch('relay:status',{relay:relay[1],status:payload.trim().toUpperCase()==='ON'});return;}
        if(topic===this.config.topics.online){this.dispatch('esp:status',payload.trim().toLowerCase()==='online');return;}
        if(topic===this.config.topics.modeStatus){this.dispatch('mode:status',payload.trim().toUpperCase()==='AUTO');return;}
        const sched=topic.match(/^smartfarm\/schedule\/(pump|zone1|lighthome|lightsala)\/status$/);
        if(sched){this.dispatch('schedule:status',{relay:sched[1],payload});return;}
        if(topic===this.config.topics.sensor('dht11'))this.dispatch('sensor:data',{type:'dht11',value:payload});
        this.dispatch('mqtt:message',{topic,payload});
    }
    dispatch(name,detail){window.dispatchEvent(new CustomEvent(name,{detail}));}
}
window.mqttHandler=new MqttHandler(MQTT_CONFIG);
