(() => {
  const KEY='vyra-action-event-v2';
  const audiences=[['everyone','Alla'],['follower','Alla följare'],['subscriber','Alla prenumeranter'],['moderator','Alla moderatorer'],['topGifter','Top Gifter'],['specificUser','En specifik användare']];
  const triggers=[['join','Går med i liven'],['firstActivity','Första aktiviteten'],['share','Delar liven'],['follow','Börjar följa'],['member','Prenumererar'],['likes','Skickar likes (taps)'],['chat','Skriver en kommentar'],['chatCommand','Skriver ett kommando'],['giftCoins','Skickar gåva med minsta coin-värde'],['gift','Skickar en specifik gåva'],['subscriberEmote','Skickar subscriber-emote'],['fanSticker','Skickar Fan Club-sticker'],['shopPurchase','Köper en produkt från TikTok Shop']];
  const triggerSupport={
    join:{live:true},
    firstActivity:{live:true},
    share:{live:true},
    follow:{live:true},
    member:{live:true},
    likes:{live:true},
    chat:{live:true},
    chatCommand:{live:true},
    giftCoins:{live:true},
    gift:{live:true},
    subscriberEmote:{live:false,note:'Inte kopplad till nuvarande TikTok-bridge ännu.'},
    fanSticker:{live:false,note:'Inte kopplad till nuvarande TikTok-bridge ännu.'},
    shopPurchase:{live:false,note:'Inte kopplad till nuvarande TikTok-bridge ännu.'}
  };
  const opts=a=>a.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
  const triggerOption=([value,label],index)=>{
    const support=triggerSupport[value]||{live:true};
    const badge=support.live?'':' <small>Ej tillgänglig i live just nu</small>';
    return `<label class="${support.live?'':'ae-trigger-disabled'}"><input type="radio" name="aeAdvancedTrigger" value="${value}" ${index?'':'checked'} ${support.live?'':'disabled'}> ${label}${badge}</label>`;
  };
  const readState=()=>{
    try{
      return JSON.parse(localStorage.getItem(KEY)||'{"actions":[],"events":[]}');
    }catch(e){
      console.warn('[VYRA] Ogiltig advanced action-state',e);
      return {actions:[],events:[]};
    }
  };
  function enhance(){
    const m=document.querySelector('.ae-modal'); if(!m||m.querySelector('h3')?.textContent.trim()!=='Nytt Event'||m.querySelector('.ae-event-advanced'))return;
    const s=readState(),footer=m.querySelector('footer');
    m.querySelector('#aeTrigger')?.closest('label')?.classList.add('ae-legacy-event-field');m.querySelector('#aeActionId')?.closest('label')?.classList.add('ae-legacy-event-field');
    const p=document.createElement('div');p.className='ae-event-advanced';p.innerHTML=`<section><h4>Vem får trigga eventet?</h4><div class="ae-radio-list">${audiences.map((a,i)=>`<label><input type="radio" name="aeAudience" value="${a[0]}" ${i?'':'checked'}> ${a[1]}</label>`).join('')}</div><label id="aeSpecificUserWrap" hidden>Användarnamn<input id="aeSpecificUser" placeholder="@användarnamn"></label></section><section><h4>Vad ska trigga eventet?</h4><div class="ae-radio-list">${triggers.map(triggerOption).join('')}</div><small id="aeTriggerSupportHint">Välj en trigger som stöds av nuvarande live-källa.</small><div id="aeTriggerDetails" class="ae-trigger-details"></div></section><section><h4>Team och Actions</h4><label>Nödvändig TikTok-teamnivå<input id="aeTeamLevel" type="number" min="0" max="50" value="0"><small>Ange 0 för personer som inte är med i teamet.</small></label><label>Kör alla dessa Actions<select id="aeAllActions" multiple size="${Math.min(5,Math.max(2,s.actions.length))}">${opts(s.actions)}</select><small>Håll Ctrl för att välja flera.</small></label><label>Kör en av dessa Actions slumpmässigt<select id="aeRandomActions" multiple size="${Math.min(5,Math.max(2,s.actions.length))}">${opts(s.actions)}</select></label></section>`;footer.before(p);
    const sync=()=>{const current=p.querySelector('[name=aeAdvancedTrigger]:checked')||p.querySelector('[name=aeAdvancedTrigger]:not(:disabled)');if(!current)return;current.checked=true;const v=current.value,support=triggerSupport[v]||{live:true},map={join:'member',firstActivity:'member',share:'share',follow:'follow',member:'member',likes:'likes',chat:'chat',chatCommand:'chat',giftCoins:'gift',gift:'gift',subscriberEmote:'chat',fanSticker:'chat',shopPurchase:'gift'},sel=m.querySelector('#aeTrigger');if(sel&&[...sel.options].some(o=>o.value===map[v])){sel.value=map[v];sel.dispatchEvent(new Event('change',{bubbles:true}))}const d=p.querySelector('#aeTriggerDetails');const hint=p.querySelector('#aeTriggerSupportHint');hint.textContent=support.live?'Triggern stöds av nuvarande live-källa.':support.note||'Triggern stöds inte av nuvarande live-källa.';d.innerHTML=v==='chatCommand'?'<label>Kommando<input id="aeAdvancedValue" placeholder="Exempel: !hype"></label>':v==='giftCoins'?'<label>Minsta coin-värde<input id="aeAdvancedValue" type="number" min="1" value="1"></label>':v==='gift'?'<label>Gåvans namn<input id="aeAdvancedValue" placeholder="Exempel: Rose"></label>':''};
    p.querySelectorAll('[name=aeAdvancedTrigger]').forEach(x=>x.onchange=sync);p.querySelectorAll('[name=aeAudience]').forEach(x=>x.onchange=()=>p.querySelector('#aeSpecificUserWrap').hidden=x.value!=='specificUser'||!x.checked);sync();
    const before=s.events.length;m.querySelector('#saveAeEvent').addEventListener('click',event=>{const selected=q=>[...p.querySelector(q).selectedOptions].map(o=>o.value),chosen=p.querySelector('[name=aeAdvancedTrigger]:checked')?.value,support=triggerSupport[chosen]||{live:true};if(!support.live){event.preventDefault();event.stopImmediatePropagation();window.toast?.('Den triggern har ingen skarp live-källa ännu');return;}const extra={audience:p.querySelector('[name=aeAudience]:checked').value,specificUser:p.querySelector('#aeSpecificUser').value.trim().replace(/^@/,''),advancedTrigger:chosen,triggerValue:p.querySelector('#aeAdvancedValue')?.value?.trim()||'',teamLevel:+p.querySelector('#aeTeamLevel').value,allActionIds:selected('#aeAllActions'),randomActionIds:selected('#aeRandomActions')};if(extra.allActionIds.length)m.querySelector('#aeActionId').value=extra.allActionIds[0];else if(extra.randomActionIds.length)m.querySelector('#aeActionId').value=extra.randomActionIds[0];let i=0,t=setInterval(()=>{const state=readState();if(state.events.length>before){Object.assign(state.events.at(-1),extra);localStorage.setItem(KEY,JSON.stringify(state));clearInterval(t)}else if(++i>40)clearInterval(t)},100)},true);
  }
  function allowed(e,p={}){if((p.teamLevel||0)<(e.teamLevel||0))return false;if(!e.audience||e.audience==='everyone')return true;if(e.audience==='specificUser')return String(p.username||p.user||'').replace(/^@/,'').toLowerCase()===String(e.specificUser||'').toLowerCase();return e.audience===p.role||(e.audience==='follower'&&p.isFollower)||(e.audience==='subscriber'&&p.isSubscriber)||(e.audience==='moderator'&&p.isModerator)||(e.audience==='topGifter'&&p.isTopGifter)}
  function handleEvent(trigger,payload={}){const s=readState();s.events.filter(e=>e.enabled&&(e.advancedTrigger||e.trigger)===trigger&&allowed(e,payload)).forEach(e=>{const expected=String(e.triggerValue||e.condition||'').trim(),actual=String(payload.value??payload.gift??payload.command??'').trim();if(expected){if((e.advancedTrigger||e.trigger)==='giftCoins'&&Number(payload.coins??payload.value??0)<Number(expected))return;if(['gift','chatCommand'].includes(e.advancedTrigger||e.trigger)&&actual.toLowerCase()!==expected.toLowerCase())return;if(!['giftCoins','gift','chatCommand'].includes(e.advancedTrigger||e.trigger)&&!actual.toLowerCase().includes(expected.toLowerCase()))return}const ids=e.allActionIds?.length?e.allActionIds:e.randomActionIds?.length?[e.randomActionIds[Math.floor(Math.random()*e.randomActionIds.length)]]:[e.actionId];ids.forEach(id=>window.VyraActionEvent?.runAction(s.actions.find(a=>a.id===id),payload))})}
  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});window.VyraAdvancedEvents={handleEvent};
})();
