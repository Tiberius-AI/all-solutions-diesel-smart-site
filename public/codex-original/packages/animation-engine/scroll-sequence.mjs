export const clamp=n=>Math.max(0,Math.min(1,n));
export const frameAt=(progress,length)=>Math.round(clamp(progress)*Math.max(0,length-1));
export function shouldAnimate({reduced=false,width=1200,saveData=false,effectiveType='4g',paused=false}={}){
 return !reduced&&width>=768&&!saveData&&!['slow-2g','2g'].includes(effectiveType)&&!paused;
}
/** Progressive image sequence. Poster remains visible until a frame is decoded. */
export function mountScrollSequence({section,canvas,media,button,onEngage=()=>{}}){
 const context=canvas.getContext('2d');if(!context)return ()=>{};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),connection=navigator.connection;
 const cache=new Map(),pending=new Map();let frame=0,paused=false,active=false,engaged=false,destroyed=false,generation=0,failed=false;
 const maxCache=4; // Four cached + at most two in-flight 1600x1000 frames: ~38.4 MB, excluding canvas.
 let requested=0,raf=0;
 function draw(img){
   const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);
   const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   const scale=Math.max(w/media.width,h/media.height),iw=media.width*scale,ih=media.height*scale;
   context.clearRect(0,0,w,h);context.drawImage(img,(w-iw)/2,(h-ih)/2,iw,ih);canvas.dataset.ready='true';canvas.dataset.frame=String(frame);
 }
 function remember(index,img){cache.delete(index);cache.set(index,img);while(cache.size>maxCache)cache.delete(cache.keys().next().value);}
 function request(index){
   if(index<0||index>=media.frames.length||cache.has(index)||pending.has(index)||pending.size>=2||failed)return;
   const img=new Image(),version=generation;pending.set(index,img);img.decoding='async';
   img.onload=()=>{pending.delete(index);if(destroyed||!active||version!==generation)return;remember(index,img);if(index===requested){frame=index;draw(img);}schedule();};
   img.onerror=()=>{pending.delete(index);failed=true;active=false;canvas.dataset.ready='false';section.dataset.motion='static';button.textContent='Static view';button.disabled=true;};
   img.src=media.frames[index];
 }
 function update(){
   raf=0;if(!active||destroyed||document.hidden)return;
   const rect=section.getBoundingClientRect(),extent=Math.max(1,section.offsetHeight-innerHeight);
   const progress=clamp(-rect.top/extent);requested=frameAt(progress,media.frames.length);
   section.dataset.progress=progress.toFixed(3);
   if(cache.has(requested)){const img=cache.get(requested);remember(requested,img);frame=requested;draw(img);}
   else request(requested);
   request(requested+1);request(requested-1);
   if(progress>.15&&!engaged){engaged=true;onEngage();}
 }
 function schedule(){if(!raf&&active)raf=requestAnimationFrame(update);}
 function configure(){
   active=!failed&&shouldAnimate({reduced:reduced.matches,width:innerWidth,saveData:connection?.saveData,effectiveType:connection?.effectiveType,paused});
   section.dataset.motion=active?'scroll':'static';button.textContent=paused?'Enable motion':'Pause motion';button.setAttribute('aria-pressed',String(paused));
   if(!active){canvas.dataset.ready='false';generation++;for(const img of pending.values()){img.onload=null;img.onerror=null;img.src='';}pending.clear();cache.clear();}
   button.hidden=!shouldAnimate({reduced:reduced.matches,width:innerWidth,saveData:connection?.saveData,effectiveType:connection?.effectiveType});
   schedule();
 }
 const toggle=()=>{paused=!paused;configure();};
 button.addEventListener('click',toggle);window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',configure);reduced.addEventListener('change',configure);connection?.addEventListener('change',configure);document.addEventListener('visibilitychange',schedule);configure();
 return ()=>{destroyed=true;active=false;generation++;cancelAnimationFrame(raf);button.removeEventListener('click',toggle);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',configure);reduced.removeEventListener('change',configure);connection?.removeEventListener('change',configure);document.removeEventListener('visibilitychange',schedule);for(const img of pending.values()){img.onload=null;img.onerror=null;img.src='';}cache.clear();pending.clear();};
}
