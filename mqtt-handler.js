// SmartFarm V5.2 MQTT Handler
class MqttHandler {
    constructor(config){this.config=config;this.client=null;}
    connect(){
        if(typeof mqtt==="undefined"){console.error("MQTT library not loaded");return;}
        if(this.client?.connected)return;
        this.client=mqtt.connect(this.config.url,{
            clientId:this.config.clientId,username:this.config.username,password:this.config.password,
            clean:true,reconnectPeriod:5000,connectTimeout:30000
        });
        this.client.on("connect",()=>{
            APP_STATE.mqttConnected=true;
            this.dispatch("mqtt:connected",true);
            this.client.subscribe("smartfarm/#");
        });
        this.client.on("message",(topic,message)=>this.handleMessage(topic,message.toString()));
        this.client.on("close",()=>{APP_STATE.mqttConnected=false;this.dispatch("mqtt:connected",false);});
        this.client.on("error",e=>{console.error("MQTT Error",e);this.dispatch("mqtt:error",e);});
    }
    handleMessage(topic,payload){
        if(topic.includes("/relay/")&&topic.endsWith("/status")){
            const relay=topic.split("/")[2]; this.dispatch("relay:status",{relay,status:payload==="ON"}); return;
        }
        if(topic===this.config.topics.online){this.dispatch("esp:status",payload==="online");return;}
        if(topic===this.config.topics.modeStatus){this.dispatch("mode:status",payload==="AUTO");return;}
        if(topic.startsWith("smartfarm/schedule/")&&topic.endsWith("/status")){
            this.dispatch("schedule:status",{relay:topic.split("/")[2],payload}); return;
        }
        if(topic.startsWith("smartfarm/sensor/")){this.dispatch("sensor:data",{type:topic.split("/")[2],value:parseFloat(payload)});}
        this.dispatch("mqtt:message",{topic,payload});
    }
    publish(topic,payload,options={}){
        if(this.client?.connected)this.client.publish(topic,payload,options);
        else console.warn("MQTT not connected");
    }
    dispatch(name,detail){window.dispatchEvent(new CustomEvent(name,{detail}));}
}
window.mqttHandler=new MqttHandler(MQTT_CONFIG);

// V5.2 dashboard controls
(function(){
    const names=RELAY_NAMES;
    let tab="pump";
    const schedules={};
    RELAYS.forEach(r=>schedules[r]={enabled:false,on:"00:00",off:"00:00"});

    function renderSchedule(){
        const s=schedules[tab];
        const e=document.getElementById("schedEnable"),on=document.getElementById("schedOn"),
              off=document.getElementById("schedOff"),sum=document.getElementById("schedSummary");
        if(e)e.checked=s.enabled;if(on)on.value=s.on;if(off)off.value=s.off;
        if(sum)sum.textContent=s.enabled?`${names[tab]}: ${s.on} - ${s.off}`:`${names[tab]}: ยังไม่เปิดใช้งาน`;
    }
    window.switchSchedTab=relay=>{
        if(!RELAYS.includes(relay))return;
        tab=relay;window.currentSchedTab=relay;
        document.querySelectorAll(".sched-tab-btn").forEach(b=>b.classList.toggle("sched-active",b.dataset.tab===relay));
        renderSchedule();
    };
    window.saveSchedule=()=>{
        const enabled=!!document.getElementById("schedEnable")?.checked;
        const on=document.getElementById("schedOn")?.value||"00:00";
        const off=document.getElementById("schedOff")?.value||"00:00";
        if(on===off){window.showToast?.("เวลาเปิดและเวลาปิดต้องไม่เท่ากัน","warning");return;}
        schedules[tab]={enabled,on,off};
        window.mqttHandler.publish(MQTT_CONFIG.topics.scheduleSet(tab),JSON.stringify(schedules[tab]),{retain:true});
        renderSchedule();window.showToast?.(`บันทึกตารางเวลา ${names[tab]} แล้ว`,"success");
    };
    window.deleteSchedule=()=>{
        schedules[tab]={enabled:false,on:"00:00",off:"00:00"};
        window.mqttHandler.publish(MQTT_CONFIG.topics.scheduleSet(tab),"DELETE");
        renderSchedule();window.showToast?.(`ลบตารางเวลา ${names[tab]} แล้ว`,"success");
    };
    function relayUI(relay,on){
        APP_STATE.relays[relay]=!!on;
        const t=document.getElementById(relay+"Toggle");if(t)t.checked=!!on;
        const s=document.getElementById(relay+"StatusText");if(s)s.textContent=on?"กำลังทำงาน":"ปิด";
        if(relay==="pump"){const p=document.getElementById("pumpStatusText");if(p)p.textContent=on?"กำลังสูบน้ำ":"หยุดรดน้ำ";}
    }
    window.addEventListener("relay:status",e=>relayUI(e.detail.relay,e.detail.status));
    window.addEventListener("schedule:status",e=>{
        if(!schedules[e.detail.relay])return;
        try{
            const x=JSON.parse(e.detail.payload);
            schedules[e.detail.relay]={enabled:!!x.enabled,on:x.on||"00:00",off:x.off||"00:00"};
            if(e.detail.relay===tab)renderSchedule();
        }catch(_){}
    });
    window.addEventListener("mode:status",e=>{APP_STATE.mode=e.detail?"auto":"manual";});
    document.addEventListener("DOMContentLoaded",()=>setTimeout(renderSchedule,100));
})();
