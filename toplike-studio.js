(function () {
  const RANKING_TYPES = ['templateTopLike', 'templateTopCoins', 'templateTopPoints'];
  const SKINS = [
    ['royal-gold', 'Royal Gold'], ['neon', 'Neon'], ['galaxy', 'Galaxy'], ['ice', 'Ice'],
    ['fire', 'Fire'], ['sakura', 'Sakura'], ['cyber', 'Cyber'], ['luxury', 'Luxury']
  ];

  // ---- Render: skin class, entrance-animation class, opacity, crown on #1 ----
  const wsRenderWh = wh;
  wh = function (w) {
    let html = wsRenderWh(w);
    if (!RANKING_TYPES.includes(w.type)) return html;
    const skin = w.skin || 'royal-gold';
    const anim = w.entranceAnimation && w.entranceAnimation !== 'none' ? ` ws-anim-${w.entranceAnimation}` : '';
    html = html.replace('class="widget vyra-toplike', `class="widget vyra-toplike skin-${skin}${anim}`);
    html = html.replace('style="', `style="opacity:${w.opacity ?? 1};`);
    if (w.showCrown !== false) html = html.replace('rank-1"><b>1</b>', 'rank-1"><i class="toplike-crown">♛</i><b>1</b>');

    // Automatic gold/silver/bronze medal ring for #1/#2/#3 — only when no custom Avatar Frame is chosen,
    // so the explicit frame picker (proTopLikeFrameBind/premiumProfileFramesBind) still wins when used.
    if (w.autoMedal !== false && (!w.profileFrame || w.profileFrame === 'none')) {
      const medals = [['1', 'gold'], ['2', 'silver'], ['3', 'bronze']];
      medals.forEach(([rank, name]) => {
        html = html.replace(
          new RegExp(`(rank-${rank}">(?:<i class="toplike-crown">[^<]*<\\/i>)?<b>${rank}<\\/b>)(<img[^>]*>)`),
          (match, prefix, img) => `${prefix}<span class="pro-avatar-frame medal-${name}">${img}<img class="pro-frame-art" src="assets/images/medals/${name}.png" alt=""></span>`
        );
      });
    }
    return html;
  };

  // ---- Props: crown toggle, skin-picker, animation group, opacity slider ----
  const wsExtraProps = props;
  props = function () {
    const html = wsExtraProps();
    const w = state.widgets.find(x => x.id === selected);
    if (!w || !RANKING_TYPES.includes(w.type)) return html;

    let out = html.replace(
      /(<input id="likeShowTitle"[^>]*>\s*Rubrik<\/label>)(<\/div>)/,
      `$1<label><input id="wsShowCrown" type="checkbox" ${w.showCrown === false ? '' : 'checked'}> Krona</label><label><input id="wsAutoMedal" type="checkbox" ${w.autoMedal === false ? '' : 'checked'}> Medaljring #1-3</label>$2`
    );

    const skin = w.skin || 'royal-gold';
    const skinGroup = `<div class="property-group"><h4>DESIGN · VÄLJ TEMA</h4><div class="toplike-skin-grid">${SKINS.map(([id, name]) => `<button type="button" data-ws-skin="${id}" class="toplike-skin-swatch skin-${id}${skin === id ? ' active' : ''}"><i></i><b>${name}</b></button>`).join('')}</div></div>`;
    const animGroup = `<div class="property-group"><h4>ANIMATION</h4><label>Inträdeseffekt<select id="wsEntrance"><option value="none">Ingen</option><option value="fade">Tona in</option><option value="slideUp">Glid upp</option><option value="pop">Poppa in</option></select></label><label class="range-label">Varaktighet <b>${w.entranceDuration || 600} ms</b><input id="wsEntranceDuration" type="range" min="150" max="1500" step="50" value="${w.entranceDuration || 600}"></label><label class="range-label">Opacitet <b>${Math.round((w.opacity ?? 1) * 100)}%</b><input id="wsOpacity" type="range" min="10" max="100" value="${Math.round((w.opacity ?? 1) * 100)}"></label></div>`;

    out = out.replace('<div class="property-group"><h4>POSITION', skinGroup + animGroup + '<div class="property-group"><h4>POSITION');
    return out;
  };

  // ---- Bind: wire crown/skin/animation/opacity controls + Content/Design/Animation tabs ----
  const wsExtraBind = bind;
  bind = function () {
    wsExtraBind();
    if (view !== 'editor') return;
    const w = state.widgets.find(x => x.id === selected);
    if (!w || !RANKING_TYPES.includes(w.type)) return;

    const crown = document.querySelector('#wsShowCrown');
    if (crown) crown.onchange = e => { w.showCrown = e.target.checked; save(); render(); };

    const autoMedal = document.querySelector('#wsAutoMedal');
    if (autoMedal) autoMedal.onchange = e => { w.autoMedal = e.target.checked; save(); render(); };

    document.querySelectorAll('[data-ws-skin]').forEach(btn => {
      btn.onclick = () => { w.skin = btn.dataset.wsSkin; save(); render(); };
    });

    const entrance = document.querySelector('#wsEntrance');
    if (entrance) { entrance.value = w.entranceAnimation || 'none'; entrance.onchange = e => { w.entranceAnimation = e.target.value; save(); render(); }; }

    const duration = document.querySelector('#wsEntranceDuration');
    if (duration) duration.onchange = e => { w.entranceDuration = +e.target.value; save(); render(); };

    const opacity = document.querySelector('#wsOpacity');
    if (opacity) opacity.onchange = e => { w.opacity = (+e.target.value) / 100; save(); render(); };

    // Content / Design / Animation tabs, built once per render cycle from the property-group headings.
    const panel = document.querySelector('.properties');
    if (!panel) return;
    const groups = [...panel.querySelectorAll('.property-group')];
    groups.forEach(g => {
      const heading = (g.querySelector('h4')?.textContent || '').toUpperCase();
      if (heading.includes('POSITION') || g.classList.contains('ranking-cycle-editor')) { delete g.dataset.wsTab; return; }
      g.dataset.wsTab = heading.includes('ANIMATION') ? 'animation' : heading.includes('DESIGN') ? 'design' : 'content';
    });

    let nav = panel.querySelector('.ws-tabs');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'ws-tabs';
      nav.innerHTML = '<button type="button" data-ws-tab="content">Content</button><button type="button" data-ws-tab="design">Design</button><button type="button" data-ws-tab="animation">Animation</button>';
      groups[0]?.before(nav);
      nav.querySelectorAll('button').forEach(btn => btn.onclick = () => {
        w.wsActiveTab = btn.dataset.wsTab;
        applyTab();
        nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      });
    }
    function applyTab() {
      const activeTab = w.wsActiveTab || 'content';
      panel.querySelectorAll('.property-group[data-ws-tab]').forEach(g => {
        g.style.setProperty('display', g.dataset.wsTab === activeTab ? 'flex' : 'none', 'important');
      });
    }
    const activeTab = w.wsActiveTab || 'content';
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.wsTab === activeTab));
    applyTab();
  };

  // ---- Bottom toolbar: Resolution selector + Export Overlay button, appended to the existing overlay-link-bar ----
  const wsToolbarBind = bind;
  bind = function () {
    wsToolbarBind();
    if (view !== 'editor') return;
    const bar = document.querySelector('.overlay-link-bar');
    if (!bar || bar.querySelector('.ws-resolution')) return;

    const resolution = document.createElement('select');
    resolution.className = 'ws-resolution';
    resolution.innerHTML = '<option value="1080x1920">1080×1920 (9:16)</option><option value="1920x1080">1920×1080 (16:9)</option><option value="1080x1080">1080×1080 (1:1)</option>';
    resolution.value = localStorage.getItem('vyra-overlay-resolution') || '1080x1920';
    resolution.onchange = () => { localStorage.setItem('vyra-overlay-resolution', resolution.value); toast('Upplösning: ' + resolution.value); };

    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'ws-export';
    exportButton.textContent = 'Exportera overlay ↓';
    exportButton.onclick = () => {
      const blob = new Blob([JSON.stringify({ widgets: state.widgets, resolution: resolution.value }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'vyra-overlay-export.json'; a.click();
      URL.revokeObjectURL(url);
      toast('Overlay exporterad');
    };

    bar.append(resolution, exportButton);
  };

  // Overlay pages auto-render on a setTimeout(0) right after page load (see media.js), which can race
  // ahead of this dynamically-loaded script. Force one re-render so skin/crown/opacity/animation are
  // reflected in OBS even when this file lost that race.
  if (new URLSearchParams(location.search).has('overlay') && typeof render === 'function') render();
})();
