const toast=document.querySelector('.toast');
let toastTimer;
const prefersReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const supportsHover=window.matchMedia('(hover: hover)').matches;
const t=(key,vars,fallback)=>{
  return window.VyraI18nHome?.t?.(key,vars)||fallback||key;
};
const nav=document.querySelector('nav');
const menuButton=document.querySelector('.menu');
const langButtons=[...document.querySelectorAll('[data-lang]')];
function notify(t){
  toast.textContent=t;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);
}

document.querySelector('.demo').onclick=()=>{
  document.querySelector('.product').scrollIntoView({behavior:'smooth'});
  setTimeout(()=>document.querySelector('.test').click(),500);
};

function popGiftAlert(){
  const el=document.querySelector('.gift-alert');
  if(!el)return;
  el.animate([
    {opacity:0,transform:'scale(.75) translateY(15px)',filter:'blur(8px)'},
    {opacity:1,transform:'scale(1)',filter:'blur(0)'}
  ],{duration:550,easing:'cubic-bezier(.2,.8,.2,1)'});
}
document.querySelector('.test').onclick=()=>{popGiftAlert();notify(t('toast.alertShown',{},'Alert visad på canvas'))};

document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>notify(t('toast.elementAdded',{name:b.querySelector('b').textContent},`${b.querySelector('b').textContent} har lagts till på canvas`)));
document.querySelector('.publish').onclick=()=>notify(t('toast.overlayPublished',{},'Overlay publicerad — OBS-länken är redo'));
document.querySelector('.subtle').onclick=()=>notify(t('toast.previewOpened',{},'Förhandsvisning öppnad'));
document.querySelectorAll('.colors i').forEach(c=>c.onclick=()=>{
  document.querySelectorAll('.colors i').forEach(x=>x.classList.remove('on'));
  c.classList.add('on');
  notify(t('toast.accentUpdated',{},'Accentfärgen uppdaterades'));
});
function syncLangButtons(){
  const current=window.VyraI18nHome?.getLang?.()||'sv';
  langButtons.forEach((button)=>{
    const isActive=button.dataset.lang===current;
    button.classList.toggle('active',isActive);
    button.setAttribute('aria-pressed',String(isActive));
  });
}

langButtons.forEach((button)=>{
  button.onclick=()=>{
    const nextLang=button.dataset.lang||'sv';
    window.VyraI18nHome?.setLang?.(nextLang);
    const url=new URL(window.location.href);
    if(nextLang==='sv') url.searchParams.delete('lang');
    else url.searchParams.set('lang',nextLang);
    window.history.replaceState({},'',url.toString());
    syncLangButtons();
    nav?.classList.remove('open');
    menuButton?.setAttribute('aria-expanded','false');
  };
});

syncLangButtons();

menuButton&&(menuButton.onclick=()=>{
  const isOpen=nav?.classList.toggle('open');
  menuButton.setAttribute('aria-expanded',String(Boolean(isOpen)));
});

nav?.querySelectorAll('a').forEach((link)=>{
  link.addEventListener('click',()=>{
    nav.classList.remove('open');
    menuButton?.setAttribute('aria-expanded','false');
  });
});

function initDepthSurface(element,{maxTiltX=7,maxTiltY=9}={}){
  if(!element)return;
  let rafId=0;
  let currentX=0;
  let currentY=0;
  let targetX=0;
  let targetY=0;

  const render=()=>{
    currentX+=(targetX-currentX)*0.14;
    currentY+=(targetY-currentY)*0.14;
    element.style.setProperty('--tilt-x',`${currentX.toFixed(2)}deg`);
    element.style.setProperty('--tilt-y',`${currentY.toFixed(2)}deg`);
    if(Math.abs(targetX-currentX)>0.02||Math.abs(targetY-currentY)>0.02){
      rafId=requestAnimationFrame(render);
    }else{
      rafId=0;
    }
  };

  const schedule=()=>{
    if(!rafId) rafId=requestAnimationFrame(render);
  };

  element.addEventListener('pointermove',(event)=>{
    const rect=element.getBoundingClientRect();
    const px=((event.clientX-rect.left)/rect.width)*2-1;
    const py=((event.clientY-rect.top)/rect.height)*2-1;
    targetX=-py*maxTiltX;
    targetY=px*maxTiltY;
    element.style.setProperty('--glow-x',`${((event.clientX-rect.left)/rect.width)*100}%`);
    element.style.setProperty('--glow-y',`${((event.clientY-rect.top)/rect.height)*100}%`);
    schedule();
  });

  element.addEventListener('pointerleave',()=>{
    targetX=0;
    targetY=0;
    element.style.setProperty('--glow-x','50%');
    element.style.setProperty('--glow-y','50%');
    schedule();
  });
}

if(!prefersReducedMotion.matches&&supportsHover){
  document.querySelectorAll('.product').forEach((element)=>initDepthSurface(element,{maxTiltX:4,maxTiltY:6}));
  document.querySelectorAll('.premium-card').forEach((element)=>initDepthSurface(element,{maxTiltX:7,maxTiltY:8}));
  document.querySelectorAll('.feature-grid article').forEach((element)=>initDepthSurface(element,{maxTiltX:6,maxTiltY:7}));
  document.querySelectorAll('.steps article').forEach((element)=>initDepthSurface(element,{maxTiltX:5,maxTiltY:5}));
  document.querySelectorAll('.cta').forEach((element)=>initDepthSurface(element,{maxTiltX:3,maxTiltY:4}));
}

/* Keep the landing page mockup feeling active without exposing internal test wording. */
if(!prefersReducedMotion.matches){
  const giftFeed=[
    {user:'@alex',gift:'Galaxy',mult:'×5'},
    {user:'@mia',gift:'Universe',mult:'×2'},
    {user:'@noah',gift:'Rose',mult:'×12'},
    {user:'@jonte',gift:'Lion',mult:'×3'}
  ];
  let giftIndex=0;
  function cycleGift(){
    const el=document.querySelector('.gift-alert');
    if(!el)return;
    const data=giftFeed[giftIndex%giftFeed.length];
    giftIndex++;
    el.querySelector('b').textContent=data.user;
    el.querySelector('span').textContent=`skickade ${data.gift}`;
    el.querySelector('strong').textContent=data.mult;
    popGiftAlert();
  }

  const chatFeed=[
    {user:'@sara',text:'Vilken grym stream! 🔥'},
    {user:'@leo',text:'Nu kör vi!'},
    {user:'@noah',text:'Den där galaxy-gåvan 👀'},
    {user:'@mia',text:'Följer nu!'},
    {user:'@jonte',text:'Bästa liven idag'}
  ];
  let chatIndex=0;
  function cycleChat(){
    const chat=document.querySelector('.chat');
    if(!chat)return;
    const msg=chatFeed[chatIndex%chatFeed.length];
    chatIndex++;
    const p=document.createElement('p');
    p.innerHTML=`<b>${msg.user}</b> ${msg.text}`;
    chat.append(p);
    p.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:400,easing:'ease-out',fill:'forwards'});
    while(chat.children.length>3)chat.firstElementChild.remove();
  }

  function bumpLikeGoal(){
    const bEl=document.querySelector('.like-goal>b');
    const iEl=document.querySelector('.like-goal>div>i');
    if(!bEl||!iEl)return;
    const current=parseInt(bEl.textContent.replace(/[^\d]/g,''),10)||84730;
    const next=Math.min(99850,current+400+Math.floor(Math.random()*900));
    bEl.innerHTML=`${next.toLocaleString('sv')} <i>/ 100K</i>`;
    iEl.style.width=Math.min(97,(next/100000)*100)+'%';
  }

  setTimeout(()=>{cycleGift();setInterval(cycleGift,4200)},900);
  setTimeout(()=>{cycleChat();setInterval(cycleChat,3300)},1500);
  setInterval(bumpLikeGoal,2600);
}
