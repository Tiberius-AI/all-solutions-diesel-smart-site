import {api} from './client.mjs';
const names={booking:'Alfred answers and helps customers book',answer:'Alfred answers questions and collects details',draft:'You approve Alfred’s replies',human:'You reply; Alfred stays quiet'};
export function mountSetup(){
 const $=s=>document.querySelector(s),inputs=[...document.querySelectorAll('[name=contact-plan]')];let current=null,saving=false,epoch=0;
 function render(){for(const input of inputs){input.checked=input.value===current?.plan;input.disabled=saving||!current;}$('#setup-summary').textContent=current?'New conversations: '+names[current.plan]:'Choose how Alfred helps';}
 async function load(){const run=++epoch;try{const data=await api('owner-settings',null,{method:'GET'});if(run!==epoch)return;if(!Object.hasOwn(names,data.plan))throw Error('Setup could not be loaded. Refresh to try again.');current=data;render();$('#setup-status').textContent='Saved choice for new conversations.';}catch(error){if(run===epoch)$('#setup-status').textContent=error.message;}}
 for(const input of inputs)input.addEventListener('change',async()=>{
  if(!current||saving)return;const plan=input.value,run=++epoch;saving=true;for(const i of inputs)i.disabled=true;$('#setup-status').textContent='Saving your choice…';
  try{const result=await api('owner-settings',{plan,version:current.version});if(run!==epoch)return;current=result;$('#setup-status').textContent='Saved. New conversations will follow this choice.';}
  catch(error){if(run!==epoch)return;$('#setup-status').textContent=error.message;try{current=await api('owner-settings',null,{method:'GET'});}catch{}}
  finally{if(run===epoch){saving=false;render();}}
 });
 $('#setup-shortcut').addEventListener('click',()=>document.querySelector('[data-section=setup]').click());
 function reset(){epoch++;current=null;saving=false;render();$('#setup-status').textContent='';}
 reset();return {load,reset};
}
