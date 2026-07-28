(() => {
  const KEY = 'vyra-action-event-v2';
  const vars = '{username} {giftname} {repeatcount} {coins} {likecount} {totallikecount} {comment} {submonth}';
  const persistentWidgetMatchers = [
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
  const fill = (text = '', p = {}) => text.replace(/\{(\w+)\}/g, (_, k) => ({username:p.username||'TestUser',giftname:p.giftname||p.gift||'Rose',repeatcount:p.repeatcount||p.combo||1,coins:p.coins||1,likecount:p.likecount||0,totallikecount:p.totallikecount||0,comment:p.comment||'',submonth:p.submonth||1}[k] ?? ''));
  const readState = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{"actions":[],"events":[]}');
    } catch (e) {
      console.warn('[VYRA] Ogiltig action-options state', e);
      return { actions: [], events: [] };
    }
  };
  const isPersistentWidget = (name = '') => persistentWidgetMatchers.some(pattern => pattern.test(String(name || '').trim().toLowerCase()));
  const widgetActionName = (widget = '') => `Overlay · ${String(widget || '').trim() || 'Widget'}`;

  function showAlert(action, payload = {}) {
    const c = action.config || {};
    let host = document.querySelector('#vyraActionAlertHost');
    if (!host) { host = document.createElement('div'); host.id = 'vyraActionAlertHost'; document.body.append(host); }
    host.innerHTML = '';
    const el = document.createElement('div');
    el.className = `vyra-action-alert ${c.alertStyle || 'premium'} ${c.alertPosition || 'bottom'}${payload.profileImage ? ' has-avatar' : ''}`;
    if (payload.profileImage) { const img = document.createElement('img'); img.className = 'vaa-avatar'; img.src = payload.profileImage; el.append(img); }
    const text = document.createElement('span'); text.className = 'vaa-text'; text.textContent = fill(c.alertText || 'Tack {username} för {giftname}!', payload); el.append(text);
    el.style.cssText = `--alert-color:${c.alertColor||'#fff'};--alert-bg:${c.alertBackground||'#16091d'};--alert-accent:${c.alertAccent||'#ff3eaa'};--alert-size:${c.alertSize||28}px;--alert-font:${c.alertFont||'Inter,Arial,sans-serif'}`;
    host.append(el); requestAnimationFrame(() => el.classList.add('show'));
    const ms = Math.max(1, action.duration || 6) * 1000;
    setTimeout(() => el.classList.remove('show'), ms - 350); setTimeout(() => el.remove(), ms);
  }

  function enhance() {
    const modal = document.querySelector('.ae-modal'), grid = modal?.querySelector('.ae-grid');
    if (!grid || modal.querySelector('.ae-action-options')) return;
    const box = document.createElement('div'); box.className = 'ae-action-options';
    box.innerHTML = `<section data-o="overlay"><h4>OVERLAY / WIDGET</h4><label>Välj widget<select id="aoWidget"><optgroup label="Fasta widgets"><option>Top Likes</option><option>Top Gifters</option><option>Top Coins</option><option>Top Points</option><option>Top Streak</option><option>Heart Me Goal</option><option>Like Goal</option><option>Follower Goal</option><option>Gift Campaign</option></optgroup><optgroup label="Tillfälliga effekter"><option>Follower Spotlight</option><option>Gift Fireworks</option><option>Battle MVP</option></optgroup></select></label><small id="aoWidgetHint">Fast widget · ligger kvar i overlayn tills ny data eller ny action ersätter den.</small></section>
    <section data-o="audio"><h4>SPELA LJUD</h4><label>Välj ljudfil<input id="aoAudio" type="file" accept="audio/*,.mp3,.wav,.ogg"></label></section>
    <section data-o="alert" class="ao-alert-settings"><h4>VISA ALERT · ANVÄNDARE + TEXT</h4><label>Alertmeddelande<input id="aoAlert" placeholder="Tack {username} för {giftname}!"></label><div class="ao-alert-toolbar"><label class="ao-color"><input id="aoAlertColor" type="color" value="#ffffff"><span>Textfärg</span></label><select id="aoAlertStyle"><option value="premium">Premium</option><option value="minimal">Minimal</option><option value="neon">Neon</option></select><button type="button" id="aoGlobalAlert">⚙ Globala overlay-inställningar</button></div><small><b>Tillgängliga variabler:</b> ${vars}</small><div id="aoGlobalPanel" class="ao-global-panel" hidden><h5>Globala inställningar för alert</h5><div class="ao-grid"><label>Placering<select id="aoAlertPosition"><option value="bottom">Längst ner</option><option value="center">Mitten</option><option value="top">Längst upp</option></select></label><label>Textstorlek <output id="aoAlertSizeOut">28 px</output><input id="aoAlertSize" type="range" min="14" max="72" value="28"></label><label>Typsnitt<select id="aoAlertFont"><option value="Inter,Arial,sans-serif">Modern</option><option value="Georgia,serif">Elegant</option><option value="Impact,sans-serif">Impact</option></select></label><label>Accentfärg<input id="aoAlertAccent" type="color" value="#ff3eaa"></label><label>Bakgrund<input id="aoAlertBg" type="color" value="#16091d"></label></div><button type="button" id="aoPreviewAlert">▶ Förhandsvisa alert</button></div></section>
    <section data-o="tts"><h4>TEXT-TILL-TAL</h4><label>Text<input id="aoTts" placeholder="Välkommen {username}!"></label><div class="ao-grid"><label>Röst<select id="aoVoice"><option>Kvinnlig röst</option><option>Manlig röst</option><option>Neutral röst</option></select></label><label>Hastighet<input id="aoSpeed" type="range" min=".5" max="2" step=".1" value="1"></label><label>Tonhöjd<input id="aoPitch" type="range" min=".5" max="2" step=".1" value="1"></label><label><input id="aoRandom" type="checkbox"> Slumpmässig röst</label></div><button type="button" id="aoTest">▶ Testa TTS</button></section>
    <section data-o="chat"><h4>CHATBOTMEDDELANDE</h4><label>Meddelande<input id="aoChat" placeholder="Välkommen {username}!"></label></section><section data-o="spotify"><h4>SPOTIFY</h4><label>Låt/spellista<input id="aoSpotify" placeholder="Spotify-länk eller sökfras"></label></section><section data-o="obsScene"><h4>BYT OBS-SCEN</h4><label>Scennamn<input id="aoObsScene" placeholder="Live - Gaming"></label></section><section data-o="obsSource"><h4>AKTIVERA OBS-KÄLLA</h4><label>Källnamn<input id="aoObsSource" placeholder="Kamera 2"></label></section><section data-o="webhook"><h4>WEBHOOK</h4><label>URL<input id="aoWebhook" type="url" placeholder="https://..."></label></section>`;
    grid.before(box);
    const read = () => ({widget:box.querySelector('#aoWidget').value,alertText:box.querySelector('#aoAlert').value,alertColor:box.querySelector('#aoAlertColor').value,alertStyle:box.querySelector('#aoAlertStyle').value,alertPosition:box.querySelector('#aoAlertPosition').value,alertSize:+box.querySelector('#aoAlertSize').value,alertFont:box.querySelector('#aoAlertFont').value,alertAccent:box.querySelector('#aoAlertAccent').value,alertBackground:box.querySelector('#aoAlertBg').value,ttsText:box.querySelector('#aoTts').value,voice:box.querySelector('#aoVoice').value,speed:+box.querySelector('#aoSpeed').value,pitch:+box.querySelector('#aoPitch').value,randomVoice:box.querySelector('#aoRandom').checked,chatText:box.querySelector('#aoChat').value,spotify:box.querySelector('#aoSpotify').value,obsScene:box.querySelector('#aoObsScene').value,obsSource:box.querySelector('#aoObsSource').value,webhook:box.querySelector('#aoWebhook').value});
    const actionName = modal.querySelector('#aeActionName');
    const duration = modal.querySelector('#aeDuration');
    const cooldown = modal.querySelector('#aeCooldown');
    const repeatCombo = modal.querySelector('#aeRepeatCombo');
    if (actionName && !actionName.dataset.autoNameBound) {
      actionName.dataset.autoNameBound = '1';
      actionName.addEventListener('input', () => {
        actionName.dataset.autoManaged = actionName.value === actionName.dataset.autoValue ? '1' : '0';
      });
    }
    const updateWidgetHint = () => {
      const widget = box.querySelector('#aoWidget').value;
      const hint = box.querySelector('#aoWidgetHint');
      const durationLabel = duration?.closest('label');
      if (!hint) return;
      const persistent = isPersistentWidget(widget);
      hint.textContent = persistent
        ? 'Fast widget · ligger kvar i overlayn tills ny data eller ny action ersätter den.'
        : 'Tillfällig effekt · visas i cirka 6 sekunder och försvinner sedan enligt visningstiden.';
      hint.style.display = 'block';
      hint.style.marginTop = '8px';
      hint.style.opacity = '.82';
      if (durationLabel) durationLabel.title = persistent
        ? 'Fast widget: visningstid används inte för att ta bort widgeten automatiskt.'
        : 'Tillfällig effekt: visningstiden styr hur länge widgeten visas.';
    };
    const applyWidgetDefaults = () => {
      const widget = box.querySelector('#aoWidget').value;
      const persistent = isPersistentWidget(widget);
      const nextName = widgetActionName(widget);
      if (actionName) {
        const shouldReplaceName = !actionName.value.trim() || actionName.dataset.autoManaged === '1' || actionName.value === actionName.dataset.autoValue;
        if (shouldReplaceName) {
          actionName.value = nextName;
          actionName.dataset.autoValue = nextName;
          actionName.dataset.autoManaged = '1';
        }
        actionName.placeholder = `Exempel: ${nextName}`;
      }
      if (duration) {
        if (!duration.dataset.autoValue || duration.value === duration.dataset.autoValue || duration.disabled) {
          duration.value = '6';
          duration.dataset.autoValue = '6';
        }
        duration.disabled = persistent;
        duration.style.opacity = persistent ? '.55' : '1';
      }
      if (cooldown) {
        const nextCooldown = persistent ? '0' : '2';
        if (!cooldown.dataset.autoValue || cooldown.value === cooldown.dataset.autoValue) {
          cooldown.value = nextCooldown;
          cooldown.dataset.autoValue = nextCooldown;
        }
        cooldown.title = persistent
          ? 'Fast widget: låg eller ingen cooldown gör att topplistan kan uppdateras direkt.'
          : 'Tillfällig effekt: liten cooldown minskar spam och dubbla körningar.';
      }
      if (repeatCombo) {
        repeatCombo.checked = !persistent && /gift|battle/i.test(widget);
        repeatCombo.disabled = persistent;
        repeatCombo.closest('label')?.setAttribute('title', persistent
          ? 'Fast widget: repeat combo används normalt inte.'
          : 'Tillfällig effekt: kan upprepas vid gift-combo om du vill.');
      }
    };
    const update = () => { const selected = [...modal.querySelectorAll('fieldset input:checked')].map(x => x.value); box.querySelectorAll('[data-o]').forEach(s => s.hidden = !selected.includes(s.dataset.o)); };
    modal.querySelectorAll('fieldset input').forEach(x => x.addEventListener('change', update));
    box.querySelector('#aoWidget').addEventListener('change', () => {
      applyWidgetDefaults();
      updateWidgetHint();
    });
    box.querySelector('#aoGlobalAlert').onclick = () => box.querySelector('#aoGlobalPanel').toggleAttribute('hidden');
    box.querySelector('#aoAlertSize').oninput = e => box.querySelector('#aoAlertSizeOut').textContent = `${e.target.value} px`;
    box.querySelector('#aoPreviewAlert').onclick = () => showAlert({duration:3,config:read()},{username:'TestUser',giftname:'Rose',repeatcount:5,coins:5});
    box.querySelector('#aoTest').onclick = () => { const text=fill(box.querySelector('#aoTts').value); if(!text)return window.toast?.('Skriv TTS-text först'); speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text);u.rate=+box.querySelector('#aoSpeed').value;u.pitch=+box.querySelector('#aoPitch').value;speechSynthesis.speak(u); };
    const before = readState().actions.length;
    modal.querySelector('#saveAeAction').addEventListener('click',()=>{const config=read();let i=0,t=setInterval(()=>{const s=readState();if(s.actions.length>before){s.actions.at(-1).config=config;localStorage.setItem(KEY,JSON.stringify(s));clearInterval(t)}else if(++i>40)clearInterval(t)},100)},true);
    applyWidgetDefaults();
    updateWidgetHint();
    update();
  }
  document.addEventListener('vyra:runtime-alert', e => { const {action,payload={}}=e.detail||{}; if(action?.types?.includes('alert'))showAlert(action,payload); });
  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
})();
