/* Minimal default controls; secondary city actions live in a closing tray. */
(function(root){if(!root.document)return;
const doc=root.document,actions=doc.querySelector('#actions'),button=doc.createElement('button');button.id='more';button.textContent='MORE';button.setAttribute('aria-label','More city actions');button.setAttribute('aria-expanded','false');let expanded=false;
function close(){root.releaseControls?.();expanded=false;actions.className='';button.textContent='MORE';button.setAttribute('aria-expanded','false');refresh()}
function refresh(){const driving=!!player.car,indoor=!!root.NightshiftHome?.kind();doc.body.setAttribute('data-driving',String(driving));doc.body.setAttribute('data-wanted',String(player.heat>=.1));doc.querySelector('#aimPad').hidden=driving||indoor||player.hp<=0;doc.querySelector('#reload').hidden=driving||indoor||player.ammo>=30||combatState.reserve<=0;doc.querySelector('#reload').disabled=!!combatState.until;doc.querySelector('#shoot').hidden=!driving&&(indoor||player.hp<=0||root.NightshiftTouchLayout?.state.autoFire!==false);doc.querySelector('#use').disabled=player.hp<=0;if(driving&&Math.abs(player.car.speed)>1)doc.querySelector('#use').hidden=true;}
button.addEventListener('click',()=>{root.releaseControls?.();if(expanded){close();return}expanded=true;actions.className='expanded';button.textContent='CLOSE';button.setAttribute('aria-expanded','true');refresh()});actions.appendChild(button);
// Close after choosing a secondary action, preserving the selected action's own handler.
actions.addEventListener('click',e=>{if(expanded&&e.target!==button&&e.target?.tagName==='BUTTON')close()});actions.addEventListener('pointerdown',e=>{if(expanded&&e.target!==button&&['job','property','salvage'].includes(e.target?.id))close()});
root.NightshiftInterface={close,refresh,expanded:()=>expanded};
root.addEventListener('keydown',e=>{if(e.key==='Escape'){root.releaseControls?.();close();return}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();if(expanded)close();if(k==='m')root.NightshiftMap?.open();if(k==='i')root.NightshiftInventory?.inspect();if(k==='g'&&!root.NightshiftHome?.paused())root.NightshiftInventory?.open('glove');if(k==='x')root.NightshiftCrime?.attempt();if(k==='z')root.NightshiftCrime?.surrender()});
refresh();
})(globalThis);
