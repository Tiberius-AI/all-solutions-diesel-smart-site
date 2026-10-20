import {mountReviewCarousels} from '/packages/site-components/review-carousel.mjs';
import {mountNavigation} from '/packages/site-components/navigation.mjs';
import {mountScrollVideo} from '/packages/animation-engine/scroll-video.mjs';
import {mountLiveWidget} from '/packages/live-site/widget.mjs';
const cleanup=[mountNavigation(),mountReviewCarousels()];
try{
 const response=await fetch('/site-config.json');if(!response.ok)throw new Error('Site configuration unavailable');const config=await response.json();
 cleanup.push(mountLiveWidget(config));
 const hero=document.querySelector('#hero');if(hero)cleanup.push(mountScrollVideo({section:hero,video:hero.querySelector('.hero-video'),media:config.media,button:document.querySelector('#motion-toggle')}));
}catch{
 // The approved calendar and public page remain useful even if initialization fails.
 document.querySelectorAll('[data-engage]').forEach(button=>{button.addEventListener('click',()=>location.assign('https://cal.com/tiberius/contractor'));});
}
window.addEventListener('pagehide',()=>cleanup.forEach(fn=>fn()),{once:true});
