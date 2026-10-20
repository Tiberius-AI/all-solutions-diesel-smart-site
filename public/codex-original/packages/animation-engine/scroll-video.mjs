import {clamp,shouldAnimate} from './scroll-sequence.mjs';

export function timeAt(progress,duration,fps=24){
  if(!Number.isFinite(duration)||duration<=0)return 0;
  return clamp(progress)*Math.max(0,duration-1/fps);
}

/** A paused video whose requested timestamp follows scroll position, never a clock. */
export function mountScrollVideo({section,video,media,button,onEngage=()=>{}}){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),connection=navigator.connection;
  const sticky=section.querySelector('.hero-sticky'),poster=section.querySelector('.hero-art');
  let posterSettled=!poster||poster.complete;
  let eligible=false,paused=false,failed=false,destroyed=false,engaged=false,seeking=false;
  let desired=0,raf=0,seekTimeout=0,loadTimeout=0,idle=0,observer;
  let near=section.getBoundingClientRect().top<innerHeight+100;
  const originalHint=section.querySelector('.scroll-hint');
  video.muted=true;video.playsInline=true;video.preload='none';

  function render(){
    if(!eligible||destroyed||!video.readyState)return;
    video.dataset.ready='true';video.dataset.time=video.currentTime.toFixed(3);
  }
  function fail(){
    if(destroyed||!eligible)return;
    failed=true;eligible=false;clearTimeout(seekTimeout);clearTimeout(loadTimeout);video.pause();
    video.removeAttribute('src');video.load();video.dataset.ready='false';
    section.dataset.motion='static';button.hidden=true;
  }
  function seek(){
    if(destroyed||!eligible||paused||document.hidden||!near||video.readyState<2||seeking)return;
    if(Math.abs(video.currentTime-desired)<1/(media.fps??24)/2){render();return;}
    seeking=true;
    try{video.currentTime=desired;}catch{fail();return;}
    seekTimeout=setTimeout(fail,4000);
  }
  function update(){
    raf=0;if(destroyed||!eligible||paused||document.hidden)return;
    const rect=section.getBoundingClientRect();
    const progress=clamp(-rect.top/Math.max(1,section.offsetHeight-sticky.offsetHeight));
    section.dataset.progress=progress.toFixed(3);
    section.style.setProperty('--scene-progress',String(progress));
    desired=timeAt(progress,Math.min(media.duration,video.duration||media.duration),media.fps);
    if(originalHint)originalHint.textContent=progress>=.98?'THE WHOLE PICTURE ↓':'SCROLL TO REVEAL ↓';
    if(progress>.15&&!engaged){engaged=true;onEngage();}
    seek();
  }
  function schedule(){if(!raf&&eligible&&!paused)raf=requestAnimationFrame(update);}
  function load(){
    idle=0;if(destroyed||!eligible||paused||!near||video.getAttribute('src'))return;
    video.preload='auto';video.src=media.video;video.load();loadTimeout=setTimeout(fail,10000);
  }
  function queueLoad(){
    if(idle||video.getAttribute('src')||!eligible||!near||paused||!posterSettled)return;
    // Keep the poster, text and CTA first in the loading order.
    idle=window.requestIdleCallback?requestIdleCallback(load,{timeout:700}):setTimeout(load,80);
  }
  function configure(){
    eligible=!failed&&shouldAnimate({reduced:reduced.matches,width:innerWidth,saveData:connection?.saveData,effectiveType:connection?.effectiveType});
    section.dataset.motion=eligible?(paused?'paused':'scroll'):'static';
    button.hidden=!eligible;button.textContent=paused?'Enable motion':'Pause motion';button.setAttribute('aria-pressed',String(paused));
    if(!eligible){
      clearTimeout(seekTimeout);clearTimeout(loadTimeout);seeking=false;video.pause();video.dataset.ready='false';
      if(video.getAttribute('src')){video.removeAttribute('src');video.load();}
    }else{queueLoad();schedule();}
  }
  function loaded(){clearTimeout(loadTimeout);if(eligible){seeking=false;render();schedule();}}
  function settled(){seeking=false;clearTimeout(seekTimeout);render();seek();}
  function errored(){if(video.getAttribute('src'))fail();}
  function toggle(){paused=!paused;configure();}
  function posterReady(){posterSettled=true;queueLoad();}
  poster?.addEventListener('load',posterReady);poster?.addEventListener('error',posterReady);
  video.addEventListener('loadeddata',loaded);video.addEventListener('seeked',settled);video.addEventListener('error',errored);
  button.addEventListener('click',toggle);window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',configure);reduced.addEventListener('change',configure);
  connection?.addEventListener('change',configure);document.addEventListener('visibilitychange',schedule);
  if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{near=entries[0].isIntersecting;if(near){queueLoad();schedule();}},{rootMargin:'100px'});observer.observe(section);}
  configure();
  return ()=>{
    destroyed=true;cancelAnimationFrame(raf);clearTimeout(seekTimeout);clearTimeout(loadTimeout);
    poster?.removeEventListener('load',posterReady);poster?.removeEventListener('error',posterReady);
    if(window.cancelIdleCallback)cancelIdleCallback(idle);else clearTimeout(idle);
    observer?.disconnect();video.pause();video.removeAttribute('src');video.load();
    video.removeEventListener('loadeddata',loaded);video.removeEventListener('seeked',settled);video.removeEventListener('error',errored);
    button.removeEventListener('click',toggle);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',configure);
    reduced.removeEventListener('change',configure);connection?.removeEventListener('change',configure);document.removeEventListener('visibilitychange',schedule);
  };
}
