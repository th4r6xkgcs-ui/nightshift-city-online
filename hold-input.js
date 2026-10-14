/* One owner per held touch action. Independent controls retain independent pointers. */
(function(root){
'use strict';
const bindings=new Set();
function bind(node,setHeld){
 let pointer=null;node.setAttribute?.('data-held','false');
 function release(){if(pointer===null)return;const old=pointer;pointer=null;node.setAttribute?.('data-held','false');setHeld(false);try{if(node.hasPointerCapture?.(old))node.releasePointerCapture?.(old)}catch{}}
 node.onpointerdown=e=>{
  if(pointer!==null||node.disabled||e.button>0)return;
  pointer=e.pointerId;
  try{node.setPointerCapture?.(pointer)}catch{pointer=null;return}
  node.setAttribute?.('data-held','true');setHeld(true);
 };
 for(const event of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(event,e=>{if(e.pointerId===pointer)release()});
 const binding={release,get pointer(){return pointer}};bindings.add(binding);return binding;
}
function releaseAll(){for(const binding of bindings)binding.release()}
root.NightshiftHoldInput={bind,releaseAll};
})(globalThis);
