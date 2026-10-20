export function element(tag,className='',text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
export async function api(action,data,{method='POST',query={}}={}){
 const response=await fetch('/api/site?action='+encodeURIComponent(action)+'&'+new URLSearchParams(query),{method,signal:AbortSignal.timeout(40000),credentials:'same-origin',headers:method==='POST'?{'Content-Type':'application/json'}:{},...(method==='POST'?{body:JSON.stringify(data??{})}:{})});
 const body=await response.json().catch(()=>({error:'The service did not respond. Please try again.'}));
 if(!response.ok){const error=new Error(body.error??'The request could not be completed.');error.status=response.status;error.code=body.code;throw error;}return body;
}
export async function preparePhotos(files){
 if(files.length>3)throw new Error('Choose up to three photos.');
 const prepared=[];
 for(const file of files){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Use JPG, PNG or WebP photos up to 5 MB each.');
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('That photo could not be opened. Try another image.');});
  try{if(bitmap.width*bitmap.height>25000000)throw new Error('Use a photo smaller than 25 megapixels.');
   const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   let uri=canvas.toDataURL('image/jpeg',.78);if(uri.length>700000)uri=canvas.toDataURL('image/jpeg',.5);if(uri.length>700000)throw new Error('This photo is too large after resizing. Please use a smaller image.');
   prepared.push({name:file.name.slice(0,100),data:uri.split(',')[1],type:'image/jpeg'});
  }finally{bitmap.close();}
 }return prepared;
}
let sessionPromise;
export function ensureSession(){if(!sessionPromise)sessionPromise=api('session',{}).catch(error=>{sessionPromise=null;throw error;});return sessionPromise;}
