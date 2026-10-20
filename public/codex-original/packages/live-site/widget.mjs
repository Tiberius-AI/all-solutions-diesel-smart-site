import {api,element,preparePhotos,ensureSession} from './client.mjs';
import {photoGallery,closePhotoViewer} from './conversation-photos.mjs';
export function mountLiveWidget({business}){
 const tools=document.querySelector('.engagement-tools');if(!tools)return ()=>{};tools.hidden=false;
 const dialog=tools.querySelector('dialog'),$=selector=>dialog.querySelector(selector),form=$('#helper-quote-form'),controller=new AbortController(),on=(el,type,fn)=>el.addEventListener(type,fn,{signal:controller.signal});
 let focusReturn,step=0,draft=null,files=[],photoURLs=[],busy=false,requestId=null,calStarted=false,polling=false,pending=null,conversation=null,renderKey="",chatFiles=[],chatURLs=[];
 function status(text=''){$('#helper-status').textContent=text;}
 function go(mode){for(const panel of dialog.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==mode;for(const button of dialog.querySelectorAll('.helper-modes button'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));dialog.classList.toggle('is-booking',mode==='booking');status();$('.helper-scroll').scrollTop=0;$('#helper-title').focus({preventScroll:true});if(mode==='chat')syncConversation();}
 function open(mode,service){focusReturn=document.activeElement;if(service&&[...form.elements.service.options].some(o=>o.value===service))form.elements.service.value=service;if(!dialog.open){dialog.showModal();document.body.classList.add('engagement-open');}go(mode);}
 on(document,'click',event=>{const button=event.target.closest('[data-engage]');if(button){event.preventDefault();open(button.dataset.engage,button.dataset.service);}});
 on(dialog,'click',event=>{const button=event.target.closest('[data-mode]');if(button)go(button.dataset.mode);});
 on($('.helper-close'),'click',()=>dialog.close());on(dialog,'close',()=>{closePhotoViewer();document.body.classList.remove('engagement-open');focusReturn?.focus({preventScroll:true});});
 function chip(label,fn){const b=element('button','',label);b.type='button';on(b,'click',fn);return b;}
 function renderConversation(){
  const log=$('#helper-log'),rows=conversation?.messages??[];
  const key=JSON.stringify([rows,pending,conversation?.mode]);if(key===renderKey)return;renderKey=key;
  const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<80;
  log.replaceChildren();
  if(!rows.length&&!pending)log.append(element('p','helper-bubble','Ask a roofing question or tell us about your project. Your conversation is saved with Tiberius for the demo owner to review.'));
  const add=m=>{const box=element('div','helper-bubble'+(m.sender==='Visitor'?' from-visitor':m.sender==='Owner'?' from-owner':''));box.dataset.messageId=m.id;
   box.append(element('span','message-author',m.sender==='AI'?(m.ownerApproved?'Alfred · approved by owner':'Alfred · AI'):m.sender==='Owner'?'Tiberius · Owner':'You'),element('p','message-content',m.content));
   if(m.photos?.length)box.append(photoGallery(m.photos));
   box.append(element('small','message-meta',(m.createdAt?new Date(m.createdAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+' · ':'')+m.status));log.append(box);};
  rows.forEach(add);if(pending&&!rows.some(m=>m.id===pending.id))add({id:pending.id,sender:'Visitor',content:pending.text,status:pending.failed?'Not delivered · retry below':'Sending…'});
  $('#helper-chat-mode').textContent=conversation?.mode==='Human'?'Human mode · The demo owner can reply here.':conversation?.mode==='Draft'?'Owner review · Replies are reviewed by the demo owner.':'AI mode · Alfred answers roofing questions.';
  if(atBottom||pending)log.scrollTop=log.scrollHeight;
 }
 async function syncConversation(){
  if(polling)return;polling=true;
  try{await ensureSession();conversation=await api('conversation',null,{method:'GET'});renderConversation();$('#helper-connection').textContent='Conversation saved · checks for replies every 3 seconds';}
  catch(error){$('#helper-connection').textContent=error.status===401?'Your session expired. Reload to start a new conversation.':'Updates paused. Reconnecting…';}
  finally{polling=false;}
 }
 const modeLabel=element('p','helper-hint');modeLabel.id='helper-chat-mode';$('#helper-log').before(modeLabel);
 const connection=element('p','helper-hint');connection.id='helper-connection';connection.setAttribute('role','status');$('#helper-chat-form').after(connection);
 const pollTimer=setInterval(()=>{if(dialog.open&&!document.hidden)syncConversation();},3000);
 on(document,'visibilitychange',()=>{if(!document.hidden&&dialog.open)syncConversation();});
 function chips(values){$('#helper-chips').replaceChildren(...values.map(value=>chip(value,()=>reply(value))));}
 chips(['My roof is leaking','Architectural or 3-tab shingles?','What areas do you serve?','Book a demo appointment']);
 function clearChatPhotos(){chatURLs.forEach(URL.revokeObjectURL);chatURLs=[];chatFiles=[];$('#chat-photos').value='';$('#chat-photo-previews').replaceChildren();}
 function previewChatPhotos(){
  chatURLs.forEach(URL.revokeObjectURL);chatURLs=[];const preview=$('#chat-photo-previews');preview.replaceChildren();
  for(const [index,file] of chatFiles.entries()){const card=element('div','chat-photo-selection'),img=element('img');img.src=URL.createObjectURL(file);chatURLs.push(img.src);img.alt='Ready to send: '+file.name;const remove=chip('Remove '+file.name,()=>{chatFiles.splice(index,1);previewChatPhotos();});card.append(img,remove);preview.append(card);}
 }
 on($('#chat-photos'),'change',()=>{const chosen=[...$('#chat-photos').files];$('#chat-photos').value='';if(chosen.length+chatFiles.length>3||chosen.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024)){status('Choose up to three JPG, PNG or WebP photos, up to 5 MB each.');return;}chatFiles.push(...chosen);previewChatPhotos();status('');});
 async function reply(value,retryId,retryPhotos){
  const text=String(value).trim();if(busy||(!text&&!chatFiles.length&&!retryPhotos?.length))return;if(text.length>1000){status('Please keep the message under 1,000 characters.');return;}
  busy=true;$('#chat-photos').disabled=true;$('#chat-photo-previews').querySelectorAll('button').forEach(b=>b.disabled=true);$('#helper-chat-form button').disabled=true;$('#helper-chips').replaceChildren();status('');$('#helper-message').value='';const id=retryId??crypto.randomUUID();pending={id,text:text||'Sharing photos…',failed:false};renderConversation();let prepared=retryPhotos;
  try{
   prepared??=await preparePhotos(chatFiles);await ensureSession();const result=await api('chat',{message:text,requestId:id,...(prepared.length?{photos:prepared}:{})});pending=null;clearChatPhotos();
   await syncConversation();status(result.draft?'Your message is saved. The demo owner will review the reply.':result.human?'Message delivered to the owner.':'');
   const a=result.answers??{};for(const key of ['service','zip','urgency'])if(a[key]&&(key==='zip'||[...form.elements[key].options].some(o=>o.value===a[key])))form.elements[key].value=a[key];if(a.detail&&!form.elements.description.value)form.elements.description.value=a.detail;
   const actions=[chip('Add my project details',()=>go('quote')),chip('Book a Tiberius demo',()=>go('booking'))];if(result.action==='booking')actions.reverse();$('#helper-chips').replaceChildren(...actions);
  }catch(error){pending={id,text,failed:true};await syncConversation();const delivered=conversation?.messages?.some(m=>m.id===id);if(delivered){pending=null;clearChatPhotos();}renderConversation();status((delivered?'Your message is saved for the owner. ':'')+error.message);
   $('#helper-chips').replaceChildren(chip('Use the request form',()=>go('quote')),chip(delivered?'Retry AI answer':'Retry message',()=>reply(text,id,prepared)),chip('Book a demo',()=>go('booking')));
  }finally{busy=false;$('#chat-photos').disabled=false;$('#chat-photo-previews').querySelectorAll('button').forEach(b=>b.disabled=false);$('#helper-chat-form button').disabled=false;renderConversation();}
 }
 on($('#helper-chat-form'),'submit',event=>{event.preventDefault();reply($('#helper-message').value);});
 $('#booking-explanation').textContent='Choose a real demo appointment with Michael at Tiberius. This does not book a visit from SCG Roofing. The calendar shows available times in your selected time zone.';
 const show=chip('Show available demo times',()=>{
  if(calStarted)return;calStarted=true;$('#cal-embed').hidden=false;show.disabled=true;
  const cal=window.Cal??function(){(cal.q??=[]).push(arguments);};window.Cal=cal;cal.q??=[];cal.ns??={};cal.loaded=true;
  const script=document.createElement('script');script.src='https://app.cal.com/embed/embed.js';script.async=true;script.onerror=()=>{$('#cal-embed').replaceChildren(element('p','','The calendar could not load here. Use the direct calendar link below.'));show.disabled=false;calStarted=false;};document.head.append(script);
  cal('init',{origin:'https://cal.com'});cal('inline',{elementOrSelector:'#cal-embed',calLink:'tiberius/contractor',config:{layout:'month_view',theme:'light'}});
  cal('on',{action:'bookingSuccessfulV2',callback:event=>{status('Cal.com has received your booking. Check its confirmation for the appointment status.');const data=event.detail?.data;if(data?.uid)ensureSession().then(()=>api('booking-report',{uid:data.uid,startTime:data.startTime,status:data.status})).catch(()=>{});}});
 });show.className='button';const link=element('a','helper-plain','Open the calendar in a new tab');link.href=business.bookingUrl;link.target='_blank';link.rel='noopener noreferrer';$('#booking-action').append(show,link);
 $('#text-explanation').textContent='The demo texting number is not connected yet. You can leave a request or book a Tiberius demo appointment.';$('#text-action').append(chip('Use the request form',()=>go('quote')));
 function updateStep(){form.querySelectorAll('[data-step]').forEach(el=>el.hidden=Number(el.dataset.step)!==step);$('#quote-step').textContent=`Step ${step+1} of 3 · ${['Your project','The property','How to follow up'][step]}`;$('#quote-title').textContent=['Let’s start with your roof.','A little about the property.','How should we follow up?'][step];$('#quote-back').hidden=step===0;$('#quote-next').textContent=step===2?'Review my request':'Continue';$('#helper-error').textContent='';$('#quote-title').focus({preventScroll:true});$('.helper-scroll').scrollTop=0;}
 on($('#quote-back'),'click',()=>{step=Math.max(0,step-1);updateStep();});
 on(form.elements.method,'change',()=>{const phone=form.elements.method.value==='phone';form.elements.value.type=phone?'tel':'email';form.elements.value.autocomplete=phone?'tel':'email';$('#helper-contact-label').textContent=phone?'Phone number':'Email address';});
 function clearPhotos(){photoURLs.forEach(URL.revokeObjectURL);photoURLs=[];}
 on($('#helper-photos'),'change',()=>{clearPhotos();files=[];$('#helper-photo-previews').replaceChildren();const chosen=[...$('#helper-photos').files];if(chosen.length>3||chosen.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024)){$('#helper-error').textContent='Choose up to three JPG, PNG or WebP photos, up to 5 MB each.';$('#helper-photos').value='';return;}files=chosen;for(const f of files){const img=element('img');img.src=URL.createObjectURL(f);photoURLs.push(img.src);img.alt='Selected photo: '+f.name;img.width=80;img.height=64;$('#helper-photo-previews').append(img);}});
 on(form,'submit',event=>{
  event.preventDefault();if(form.elements.website.value)return;
  for(const input of form.querySelectorAll(`[data-step="${step}"] input,[data-step="${step}"] textarea,[data-step="${step}"] select`)){if(!input.checkValidity()){input.reportValidity();return;}}
  if(step<2){step++;updateStep();return;}
  const data=new FormData(form);draft={name:data.get('name').trim(),contactMethod:data.get('method'),contactValue:data.get('value').trim(),service:data.get('service'),description:data.get('description').trim(),zip:data.get('zip'),urgency:data.get('urgency'),intent:data.get('intent'),address:data.get('address').trim(),propertyType:data.get('propertyType'),roofAge:data.get('roofAge'),contactWindow:data.get('contactWindow'),consent:data.get('consent')==='on',website:''};requestId=crypto.randomUUID();
  const box=$('#helper-review');$('#quote-content').hidden=true;box.hidden=false;box.replaceChildren(element('h3','','Your request, ready to review.'),element('p','helper-intro','This demonstration sends the request to Tiberius, not SCG. It does not confirm a price or appointment.'));
  const dl=element('dl');for(const [k,v] of [['Project',draft.service+': '+draft.description],['Location',draft.zip+(draft.address?' · '+draft.address:'')],['Contact',draft.name+' · '+draft.contactValue],['Photos',files.map(f=>f.name).join(', ')||'None'],['Permission','Follow-up about this inquiry only; no marketing.']])dl.append(element('dt','',k),element('dd','',v));box.append(dl);
  const actions=element('div','quote-actions');actions.append(chip('Edit details',()=>{box.hidden=true;$('#quote-content').hidden=false;updateStep();}));const save=chip('Submit demo request',()=>saveLead(save));save.className='button';actions.append(save);box.append(actions);box.tabIndex=-1;box.focus();$('.helper-scroll').scrollTop=0;
 });
 async function saveLead(button){
  if(button.disabled)return;button.disabled=true;button.textContent='Saving your request…';status('');
  try{await ensureSession();const photos=await preparePhotos(files);const result=await api('lead',{...draft,photos,requestId});const box=$('#helper-review');box.replaceChildren(element('div','request-saved','✓'),element('h3','','Your demo request is saved.'),element('p','helper-intro','Tiberius can now review the project details. Nothing was sent to SCG, and no appointment has been booked.'),element('p','helper-hint','Reference: '+result.reference));const book=chip('Choose a Tiberius demo time',()=>go('booking'));book.className='button';box.append(book);clearPhotos();files=[];box.focus();}
  catch(error){status(error.message);button.disabled=false;button.textContent='Try submitting again';}
 }
 const query=new URLSearchParams(location.search),service=business.services.find(s=>s.slug===query.get('service'));if(service)form.elements.service.value=service.label;if(/^\d{5}$/.test(query.get('zip')??''))form.elements.zip.value=query.get('zip');
 on(dialog,'keydown',event=>{if(event.key!=='Tab')return;const els=[...dialog.querySelectorAll('button,a[href],input,select,textarea,iframe,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=els[0],last=els.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===$('#helper-title'))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
 return ()=>{clearInterval(pollTimer);controller.abort();clearPhotos();clearChatPhotos();closePhotoViewer();if(dialog.open)dialog.close();document.body.classList.remove('engagement-open');};
}
