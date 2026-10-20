import {api} from './client.mjs';
export function mountHandoff({getActive,reload}){
 const $=s=>document.querySelector(s),buttons=[...document.querySelectorAll('[data-handoff-mode]')];
 let data=null,draftId=null,changing=false,resolving=false;const generations=new Set(),generationKey=s=>s.id+":"+s.version+":"+s.sequence;
 const explanations={AI:'Alfred replies to new visitor messages automatically. Assigning him also answers the latest unanswered message.',Draft:'Alfred prepares replies for your review. Only Approve and send delivers a draft to the visitor.',Human:'You handle replies. Alfred will stay paused until you assign him again.'};
 function render(next){
  if(next.id!==getActive())return;data=next;
  for(const b of buttons){b.setAttribute('aria-pressed',String(b.dataset.handoffMode===data.mode));b.disabled=changing;}
  $('#handoff-explanation').textContent=explanations[data.mode];
  const state=data.assistant?.state??'ready',latest=data.messages.at(-1),canGenerate=data.mode!=='Human'&&data.status==='Open'&&data.visitorCanReply&&latest?.sender==='Visitor';
  $('#generate-reply').hidden=data.mode==='Human';$('#generate-reply').textContent=data.mode==='Draft'?'Create draft':'Ask Alfred to reply';$('#generate-reply').disabled=!canGenerate||generations.has(generationKey(data))||changing||state==='working'||state==='draft';
  $('#assistant-state').textContent=state==='working'?'Alfred is working… You can take over at any time.':state==='draft'?'Draft ready for your review.':state==='unavailable'?'Alfred could not complete this reply. You can reply personally, or take over and reassign him for a new attempt.':data.status==='Closed'?'Conversation closed.':!data.visitorCanReply?'Visitor session expired; history is saved.':data.mode==='Human'?'':canGenerate?'Ready for the latest visitor message.':'Waiting for the next visitor message.';
  const draft=data.assistant?.draft;$('#alfred-draft').hidden=!draft;
  if(draft&&draft.id!==draftId){draftId=draft.id;$('#draft-message').value=draft.text;$('#draft-status').textContent='';}
  if(!draft){draftId=null;$('#draft-message').value='';}
  $('#approve-draft').disabled=resolving;$('#dismiss-draft').disabled=resolving;$('#draft-message').disabled=resolving;
 }
 function reset(){data=null;draftId=null;$('#alfred-draft').hidden=true;$('#draft-message').value='';$('#handoff-status').textContent='';$('#handoff-explanation').textContent='Loading handling settings…';$('#assistant-state').textContent='';$('#generate-reply').hidden=true;for(const b of buttons)b.disabled=true;}
 async function generate(snapshot){
  if(generations.has(generationKey(snapshot))||snapshot.mode==='Human'||snapshot.status!=='Open'||!snapshot.visitorCanReply||snapshot.messages.at(-1)?.sender!=='Visitor')return;
  const key=generationKey(snapshot);generations.add(key);if(getActive()===snapshot.id){$('#handoff-status').textContent=snapshot.mode==='Draft'?'Preparing a private draft…':'Alfred is preparing a reply…';render(snapshot);}
  try{await api('owner-generate',{id:snapshot.id,requestId:crypto.randomUUID(),version:snapshot.version,sequence:snapshot.sequence});if(getActive()===snapshot.id)$('#handoff-status').textContent='';}
  catch(error){if(getActive()===snapshot.id)$('#handoff-status').textContent=error.message;}
  finally{generations.delete(key);if(getActive()===snapshot.id)await reload(snapshot.id).catch(()=>{});}
 }
 for(const button of buttons)button.addEventListener('click',async()=>{
  if(!data||changing||data.id!==getActive())return;const previous=data,id=data.id,mode=button.dataset.handoffMode;if(mode===data.mode)return;
  changing=true;render(data);$('#handoff-status').textContent='Updating handling…';
  try{await api('owner-mode',{id,mode,version:previous.version});if(getActive()!==id)return;await reload(id);$('#handoff-status').textContent=mode==='Human'?'You’re handling this conversation.':'Handling updated.';}
  catch(error){if(getActive()===id){$('#handoff-status').textContent=error.message;await reload(id).catch(()=>{});}return;}
  finally{changing=false;if(data&&data.id===getActive())render(data);}
  if(data?.id===id&&data.mode===mode&&mode!=='Human')await generate(data);
 });
 $('#generate-reply').addEventListener('click',()=>{if(data)generate(data);});
 async function resolve(dismiss){
  if(!data||!draftId||resolving||data.id!==getActive())return;const id=data.id,draft=draftId,message=$('#draft-message').value.trim();
  if(!dismiss&&!message){$('#draft-status').textContent='Write a reply before sending.';return;}
  resolving=true;render(data);$('#draft-status').textContent=dismiss?'Dismissing…':'Sending approved reply…';
  try{await api(dismiss?'owner-draft-dismiss':'owner-draft-approve',{conversationId:id,id:draft,...(!dismiss?{message}:{})});if(getActive()===id)$('#handoff-status').textContent=dismiss?'Draft dismissed. You can create another when ready.':'Approved reply delivered. Alfred remains in Draft mode.';}
  catch(error){if(getActive()===id)$('#draft-status').textContent=error.message;}
  finally{resolving=false;if(getActive()===id)await reload(id).catch(()=>{});}
 }
 $('#approve-draft').addEventListener('click',()=>resolve(false));$('#dismiss-draft').addEventListener('click',()=>resolve(true));reset();return {render,reset};
}
