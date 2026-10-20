import {element} from './client.mjs';
let viewer,fullImage,title,returnFocus;
export function closePhotoViewer(){if(viewer?.open)viewer.close();}
function openPhoto(url,name,button){
 if(!viewer){viewer=element('dialog','conversation-photo-viewer');viewer.setAttribute('aria-label','Photo preview');const header=element('header');title=element('strong');const close=element('button','','Close photo');close.type='button';close.addEventListener('click',()=>viewer.close());header.append(title,close);fullImage=element('img');viewer.append(header,fullImage);document.body.append(viewer);viewer.addEventListener('close',()=>{fullImage.removeAttribute('src');returnFocus?.focus();});viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});}
 returnFocus=button;title.textContent=name;fullImage.alt=name;fullImage.src=url;viewer.showModal();
}
export function photoGallery(photos=[],{owner=false,conversation}={}){
 const gallery=element('div','conversation-photos');
 for(const photo of photos){const url=photo.leadId?'/api/site?action=photo&'+new URLSearchParams({lead:photo.leadId,photo:photo.id}):'/api/site?action='+(owner?'owner-message-photo':'message-photo')+'&'+new URLSearchParams({photo:photo.id,...(owner?{conversation}:{})});
  const button=element('button','conversation-photo');button.type='button';button.setAttribute('aria-label','Enlarge '+photo.name);
  const img=element('img');img.src=url;img.alt=photo.name;img.loading='lazy';img.width=240;img.height=180;
  img.addEventListener('error',()=>{img.hidden=true;button.querySelector('span').textContent='Photo unavailable';button.disabled=true;});
  button.append(img,element('span','',photo.name));button.addEventListener('click',()=>openPhoto(url,photo.name,button));gallery.append(button);
 }return gallery;
}
