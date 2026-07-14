(function(){
  const timers=new WeakMap();
  function restart(el,duration=6000){
    if(!el)return;
    clearTimeout(timers.get(el));
    el.classList.remove('vyra-fx-playing');
    void el.offsetWidth;
    el.classList.add('vyra-fx-playing');
    if(el.classList.contains('pink-princess-x2')&&typeof window.startPinkPrincessCanvas==='function')window.startPinkPrincessCanvas(el,duration);
    timers.set(el,setTimeout(()=>el.classList.remove('vyra-fx-playing'),duration));
  }
  window.VyraFX={play(target,duration){let el=typeof target==='string'?document.querySelector(target):target;restart(el,duration)},stop(target){let el=typeof target==='string'?document.querySelector(target):target;if(el){clearTimeout(timers.get(el));el.classList.remove('vyra-fx-playing')}}};
})();
