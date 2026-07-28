(() => {
  const seen=new Set();
  const actionRunChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('vyra-action-run'):null;
  const persistentRuntimeWidgetMatchers=[
    /\btop likes?\b/,
    /\btop likers?\b/,
    /\btop coins?\b/,
    /\btop gift(?:ers?|er)\b/,
    /\btop points?\b/,
    /\btop streak\b/,
    /\bheart me goal\b/,
    /\blike goal\b/,
    /\bfollower(?:s)? goal\b/,
    /\bgift campaigns?\b/
  ];
  const params=new URLSearchParams(location.search);
  if(params.has('overlay')&&params.has('scene')){
    const scene=params.get('scene');
    document.documentElement.dataset.overlayScene=scene;
    window.VYRA_OVERLAY_SCENE=+scene;
    const heartbeatKey=`vyra-scene-heartbeat-${scene}`;
    const heartbeat=()=>localStorage.setItem(heartbeatKey,String(Date.now()));
    heartbeat();
    setInterval(heartbeat,2000);
    addEventListener('beforeunload',()=>localStorage.removeItem(heartbeatKey));
  }
  const fill=(text='',p={})=>text.replace(/\{(\w+)\}/g,(_,k)=>({username:p.username||p.user||'Användare',giftname:p.giftname||p.gift||'gåvan',repeatcount:p.repeatcount||p.combo||1,coins:p.coins||0,likecount:p.likecount||p.likes||0,totallikecount:p.totallikecount||p.totalLikes||0,comment:p.comment||'',submonth:p.submonth||1}[k]??''));
  function showAlert(action,payload={}){
    const c=action.config||{};
    let host=document.querySelector('#vyraActionAlertHost');
    if(!host){host=document.createElement('div');host.id='vyraActionAlertHost';document.body.append(host)}
    host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9999;';
    clearTimeout(host._vyraAlertHideTimer);
    clearTimeout(host._vyraAlertClearTimer);
    const root=host.shadowRoot||host.attachShadow({mode:'open'});
    const text=fill(c.alertText||'Tack {username} för {giftname}!',payload);
    host.dataset.lastAlertText=text;
    root.innerHTML=`<style>
      .alert{position:absolute;left:50%;transform:translateX(-50%) scale(.96);display:flex;align-items:center;gap:12px;max-width:min(78vw,760px);padding:14px 18px;border-radius:18px;background:${c.alertBackground||'#16091d'};color:${c.alertColor||'#fff'};border:1px solid ${c.alertAccent||'#ff3eaa'};box-shadow:0 18px 44px rgba(0,0,0,.35);font:${c.alertSize||28}px ${c.alertFont||'Inter,Arial,sans-serif'};opacity:0;transition:opacity .25s ease,transform .25s ease}
      .alert.show{opacity:1;transform:translateX(-50%) scale(1)}
      .alert.top{top:32px}.alert.center{top:50%;transform:translate(-50%,-50%) scale(.96)}.alert.center.show{transform:translate(-50%,-50%) scale(1)}.alert.bottom{bottom:32px}
      .avatar{width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid ${c.alertAccent||'#ff3eaa'}}
      .text{line-height:1.2}
    </style><div class="alert ${(c.alertPosition||'bottom')}">${payload.profileImage?`<img class="avatar" src="${payload.profileImage}">`:''}<span class="text"></span></div>`;
    const el=root.querySelector('.alert');
    const textNode=root.querySelector('.text');
    if(textNode)textNode.textContent=text;
    requestAnimationFrame(()=>el?.classList.add('show'));
    const ms=Math.max(1,action.duration||6)*1000;
    host._vyraAlertHideTimer=setTimeout(()=>el?.classList.remove('show'),ms-350);
    host._vyraAlertClearTimer=setTimeout(()=>{if(root)root.innerHTML=''},ms);
  }
  function isPersistentRuntimeWidget(name=''){
    const lower=String(name||'').trim().toLowerCase();
    return persistentRuntimeWidgetMatchers.some(pattern=>pattern.test(lower));
  }
  function runtimeWidgetHost(){
    let host=document.querySelector('#vyraRuntimeWidgetHost');
    if(!host){
      host=document.createElement('div');
      host.id='vyraRuntimeWidgetHost';
      host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9500;overflow:visible;';
      document.body.append(host);
    }
    return host;
  }
  function runtimeCanvasMetrics(){
    const canvas=document.querySelector('.canvas');
    if(!canvas)return {left:0,top:0,scaleX:1,scaleY:1};
    const rect=canvas.getBoundingClientRect();
    return {
      left:rect.left,
      top:rect.top,
      scaleX:rect.width/Math.max(1,canvas.offsetWidth||rect.width||1),
      scaleY:rect.height/Math.max(1,canvas.offsetHeight||rect.height||1)
    };
  }
  const activeRuntimeWidgets=new Map();
  const widgetDebugLog=[];
  let runtimeWidgetGuardTimer=null;
  function logWidgetDebug(event,data={}){
    widgetDebugLog.push({event,at:Date.now(),...data});
    if(widgetDebugLog.length>60)widgetDebugLog.splice(0,widgetDebugLog.length-60);
  }
  function clearRuntimeWidgetTimers(entry){
    if(!entry)return;
    clearTimeout(entry.hideTimer);
    clearTimeout(entry.removeTimer);
  }
  function renderRuntimeWidgets(){
    const host=runtimeWidgetHost();
    host.replaceChildren();
    activeRuntimeWidgets.forEach(entry=>{
      const card=buildRuntimeWidget(entry.action,entry.payload);
      card.dataset.runtimeEntry=entry.entryId;
      if(entry.hiding){
        card.style.opacity='0';
        card.style.transform='translateY(12px)';
      }
      host.append(card);
      if(!entry.hiding)requestAnimationFrame(()=>{card.style.opacity='1';card.style.transform='translateY(0)'});
    });
  }
  function ensureRuntimeWidgetGuard(){
    if(runtimeWidgetGuardTimer||!activeRuntimeWidgets.size)return;
    runtimeWidgetGuardTimer=setInterval(()=>{
      if(!activeRuntimeWidgets.size){
        clearInterval(runtimeWidgetGuardTimer);
        runtimeWidgetGuardTimer=null;
        return;
      }
      const host=document.querySelector('#vyraRuntimeWidgetHost');
      if(!host||host.children.length!==activeRuntimeWidgets.size)renderRuntimeWidgets();
    },250);
  }
  function widgetKey(name){return String(name||'widget').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-')}
  function widgetLabel(name){return String(name||'Widget').trim()||'Widget'}
  function widgetInitials(text=''){
    const cleaned=String(text||'').replace(/^@/,'').trim();
    if(!cleaned)return 'V';
    const parts=cleaned.split(/\s+/).filter(Boolean).slice(0,2);
    return (parts.map(part=>part.charAt(0)).join('')||cleaned.charAt(0)).slice(0,2).toUpperCase();
  }
  function widgetValue(name,payload={}){
    const lower=String(name||'').toLowerCase();
    if(lower.includes('top like'))return `♥ ${payload.totallikecount||payload.likecount||payload.likes||0}`;
    if(lower.includes('top coin'))return `● ${payload.coins||payload.value||0}`;
    if(lower.includes('top gift'))return `◉ ${payload.coins||payload.value||0}`;
    if(lower.includes('top point'))return `◆ ${payload.points||payload.value||payload.coins||0}`;
    if(lower.includes('top streak'))return `× ${payload.repeatcount||payload.combo||payload.value||0}`;
    if(lower.includes('heart me'))return `${payload.likecount||payload.likes||0} likes`;
    if(lower.includes('campaign'))return `${payload.coins||payload.value||0} / ${payload.target||100}`;
    if(lower.includes('goal'))return `${payload.current||payload.value||0} / ${payload.target||100}`;
    return payload.giftname||payload.gift||payload.comment||'Aktiv';
  }
  function widgetTitle(name,payload={}){
    const lower=String(name||'').toLowerCase();
    if(lower.includes('top like')||lower.includes('top coin')||lower.includes('top gift')||lower.includes('top point')||lower.includes('top streak'))return payload.username||payload.user||'Top supporter';
    if(lower.includes('follower'))return payload.username||payload.user||'Ny följare';
    return widgetLabel(name).toUpperCase();
  }
  function buildRuntimeWidget(action,payload={}){
    const c=action.config||{},scene=action.scene||{},name=widgetLabel(c.widget||action.name),lower=name.toLowerCase();
    const metrics=runtimeCanvasMetrics();
    const card=document.createElement('div');
    card.className=`vyra-runtime-widget ${isPersistentRuntimeWidget(lower)?'persistent':'transient'}`;
    card.dataset.widgetKey=widgetKey(name);
    card.style.cssText=`position:fixed;left:${metrics.left+((scene.x??160)*metrics.scaleX)}px;top:${metrics.top+((scene.y??1450)*metrics.scaleY)}px;width:${(scene.width??760)*metrics.scaleX}px;z-index:${scene.layer??10};pointer-events:none;background:rgba(14,10,20,.82);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:16px 18px;box-shadow:0 18px 44px rgba(0,0,0,.35);color:#fff;font:600 18px Inter,Arial,sans-serif;backdrop-filter:blur(14px);opacity:0;transform:translateY(12px);transition:opacity .25s ease,transform .25s ease;`;
    if(lower.includes('top like')||lower.includes('top coin')||lower.includes('top gift')||lower.includes('top point')||lower.includes('top streak')){
      const avatar=payload.profileImage
        ? `<img src="${payload.profileImage}" alt="" style="width:58px;height:58px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.18)">`
        : `<div style="width:58px;height:58px;border-radius:50%;display:grid;place-items:center;border:2px solid rgba(255,255,255,.18);background:linear-gradient(135deg,rgba(255,90,180,.24),rgba(120,84,255,.24));font-size:18px;font-weight:700;letter-spacing:.06em;">${widgetInitials(widgetTitle(name,payload))}</div>`;
      card.innerHTML=`<div style="display:flex;align-items:center;gap:14px;">${avatar}<div style="display:flex;flex-direction:column;gap:4px;min-width:0;"><small style="opacity:.72;font-size:11px;letter-spacing:.16em;text-transform:uppercase;">${widgetLabel(name)}</small><strong style="font-size:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${widgetTitle(name,payload)}</strong><span style="font-size:16px;color:#ff89c6;">${widgetValue(name,payload)}</span></div></div>`;
    }else{
      card.innerHTML=`<small style="opacity:.72;font-size:11px;letter-spacing:.16em;text-transform:uppercase;display:block;margin-bottom:6px;">${widgetLabel(name)}</small><strong style="font-size:22px;display:block;margin-bottom:4px;">${widgetTitle(name,payload)}</strong><span style="font-size:16px;color:#ff89c6;">${widgetValue(name,payload)}</span>`;
    }
    return card;
  }
  function showRuntimeWidget(action,payload={}){
    const c=action.config||{},name=widgetLabel(c.widget||action.name),key=widgetKey(name),persistent=isPersistentRuntimeWidget(name);
    logWidgetDebug('showRuntimeWidget:start',{actionId:action?.id||null,name,key,persistent,beforeCount:activeRuntimeWidgets.size,duration:action?.duration,types:action?.types});
    if(persistent){
      const entryId=`persistent:${key}`;
      clearRuntimeWidgetTimers(activeRuntimeWidgets.get(entryId));
      activeRuntimeWidgets.set(entryId,{entryId,action,payload,hiding:false});
      renderRuntimeWidgets();
      ensureRuntimeWidgetGuard();
      logWidgetDebug('showRuntimeWidget:persistent',{entryId,afterCount:activeRuntimeWidgets.size});
      return;
    }
    const entryId=`transient:${key}:${Date.now()}:${Math.random().toString(36).slice(2,7)}`;
    const ms=Math.max(1,action.duration||6)*1000;
    const entry={entryId,action,payload,hiding:false};
    entry.hideTimer=setTimeout(()=>{
      const current=activeRuntimeWidgets.get(entryId);
      if(!current)return;
      current.hiding=true;
      renderRuntimeWidgets();
    },Math.max(100,ms-350));
    entry.removeTimer=setTimeout(()=>{
      clearRuntimeWidgetTimers(activeRuntimeWidgets.get(entryId));
      activeRuntimeWidgets.delete(entryId);
      renderRuntimeWidgets();
    },ms);
    activeRuntimeWidgets.set(entryId,entry);
    renderRuntimeWidgets();
    ensureRuntimeWidgetGuard();
    logWidgetDebug('showRuntimeWidget:transient',{entryId,ms,afterCount:activeRuntimeWidgets.size});
  }
  function openDb(){return new Promise((ok,no)=>{const r=indexedDB.open('vyra-action-media',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('files'))r.result.createObjectStore('files')};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
  async function file(meta){if(!meta?.id)return null;const db=await openDb(),value=await new Promise((ok,no)=>{const tx=db.transaction('files');const r=tx.objectStore('files').get(meta.id);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});db.close();return value}
  function allowed(action){const scene=window.VYRA_OVERLAY_SCENE;return !!scene&&Number(action.scene?.number||1)===Number(scene)}
  function stage(action){let host=document.querySelector('#vyraActionRuntime');if(!host){host=document.createElement('div');host.id='vyraActionRuntime';(document.querySelector('.canvas')||document.body).append(host)}const scene=action.scene||{},el=document.createElement('div');el.className=`vyra-runtime-item ${action.fade?'fade':''}`;el.style.cssText=`--x:${scene.x??160};--y:${scene.y??1450};--w:${scene.width??760};--z:${scene.layer??10}`;host.append(el);requestAnimationFrame(()=>el.classList.add('active'));const ms=Math.max(1,action.duration||6)*1000;setTimeout(()=>el.classList.remove('active'),ms-350);setTimeout(()=>el.remove(),ms);return el}
  async function playMedia(action,kind,meta){const blob=await file(meta);if(!blob)return;const url=URL.createObjectURL(blob);if(kind==='audio'){const audio=new Audio(url);audio.volume=(action.volume??80)/100;audio.onended=()=>URL.revokeObjectURL(url);await audio.play().catch(()=>window.toast?.('Webbläsaren blockerade ljudet'));return}const el=stage(action),media=document.createElement(kind==='video'?'video':'img');media.src=url;if(kind==='video'){media.autoplay=true;media.playsInline=true;media.volume=(action.volume??80)/100;media.onended=()=>el.remove()}media.onload=media.onloadeddata=()=>el.classList.add('loaded');el.append(media);setTimeout(()=>URL.revokeObjectURL(url),Math.max(2,action.duration||6)*1000+1000)}
  function tts(action,payload){const c=action.config||{},text=fill(c.ttsText,payload);if(!text||!window.speechSynthesis)return;const u=new SpeechSynthesisUtterance(text);u.rate=c.speed||1;u.pitch=c.pitch||1;u.volume=(action.volume??80)/100;speechSynthesis.speak(u)}
  const receiveLog=[];
  async function execute(detail){if(!detail?.action||seen.has(detail.runId)||!allowed(detail.action))return false;seen.add(detail.runId);setTimeout(()=>seen.delete(detail.runId),15000);const {action,payload={}}=detail,types=action.types||[],c=action.config||{};if(types.includes('picture'))playMedia(action,'picture',action.pictureMedia);if(types.includes('video'))playMedia(action,'video',action.videoMedia);if(types.includes('audio'))playMedia(action,'audio',action.audioMedia);if(types.includes('alert'))showAlert(action,payload);if(types.includes('tts'))tts(action,payload);if(types.includes('overlay')||types.includes('animation'))showRuntimeWidget(action,payload);if(types.includes('chat'))document.dispatchEvent(new CustomEvent('vyra:chatbot-send',{detail:{message:fill(c.chatText,payload),action,payload}}));if(types.includes('spotify'))document.dispatchEvent(new CustomEvent('vyra:spotify-play',{detail:{query:c.spotify,action,payload}}));if(types.includes('obsScene'))document.dispatchEvent(new CustomEvent('vyra:obs-scene',{detail:{scene:c.obsScene,action}}));if(types.includes('obsSource'))document.dispatchEvent(new CustomEvent('vyra:obs-source',{detail:{source:c.obsSource,action}}));if(types.includes('webhook')&&c.webhook)fetch(c.webhook,{method:'POST',mode:'no-cors',body:JSON.stringify(payload)}).catch(()=>window.toast?.('Webhook kunde inte nås'));return true}
  function logReceive(source,detail,extra={}){
    receiveLog.push({
      source,
      runId:detail?.runId||null,
      actionId:detail?.action?.id||null,
      scene:detail?.action?.scene?.number||null,
      overlayScene:window.VYRA_OVERLAY_SCENE||null,
      allowed:!!detail?.action&&allowed(detail.action),
      seen:!!detail?.runId&&seen.has(detail.runId),
      at:Date.now(),
      ...extra
    });
    if(receiveLog.length>60)receiveLog.splice(0,receiveLog.length-60);
  }
  function receiveActionRun(detail,source='runtime'){
    logReceive(source,detail,{phase:'received'});
    try{
      const result=execute(detail);
      Promise.resolve(result).then(ok=>logReceive(source,detail,{phase:'executed',result:!!ok})).catch(error=>{
        logReceive(source,detail,{phase:'error',error:String(error)});
        console.warn('[VYRA] runtime execute misslyckades',source,error);
      });
      return result;
    }catch(error){
      logReceive(source,detail,{phase:'throw',error:String(error)});
      console.warn('[VYRA] runtime receive throw',source,error);
      return false;
    }
  }
  function deferReceiveActionRun(detail,source){
    setTimeout(()=>receiveActionRun(detail,source),0);
  }
  document.addEventListener('vyra:runtime-alert',e=>{const {action,payload={}}=e.detail||{};if(action?.types?.includes('alert'))showAlert(action,payload)});
  document.addEventListener('vyra:runtime-widget',e=>{const {action,payload={}}=e.detail||{};if(action?.types?.some(type=>['overlay','animation'].includes(type)))showRuntimeWidget(action,payload)});
  document.addEventListener('vyra:action',e=>deferReceiveActionRun(e.detail,'document'));
  actionRunChannel&&(actionRunChannel.onmessage=e=>deferReceiveActionRun(e.data,'broadcast'));
  addEventListener('storage',e=>{if(e.key==='vyra-action-run'&&e.newValue)try{deferReceiveActionRun(JSON.parse(e.newValue),'storage')}catch(error){console.warn('[VYRA] kunde inte läsa vyra-action-run',error)}});
  window.VyraActionRuntime={execute,receiveActionRun,getReceiveLog:()=>receiveLog.slice(),getDebugState:()=>({activeWidgetCount:activeRuntimeWidgets.size,activeWidgetKeys:[...activeRuntimeWidgets.keys()],receiveLog:receiveLog.slice(),widgetDebugLog:widgetDebugLog.slice()})};
})();
