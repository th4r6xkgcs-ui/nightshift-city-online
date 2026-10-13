/* Access the authoritative studios. Previewing never changes ownership. */
(function(r){'use strict';
const modes={pet:()=>r.NightshiftPetInspector?.open(),character:()=>r.NightshiftWardrobe?.open('home'),weapon:()=>r.NightshiftWeaponArt?.inspect(),vehicle:()=>{const v=r.NightshiftCars?.live?.().find(v=>v.owned);return r.NightshiftCarStyle?.open(v,'view')}};
r.NightshiftStudio=Object.freeze({open:(mode='character')=>modes[mode]?.(),close:()=>{r.NightshiftPetInspector?.close();r.NightshiftWardrobe?.close();r.NightshiftWeaponArt?.closeInspect();r.NightshiftCarStyle?.close()},paused:()=>!!(r.NightshiftPetInspector?.paused()||r.NightshiftWardrobe?.paused()||r.NightshiftWeaponArt?.paused()||r.NightshiftCarStyle?.paused())});
})(globalThis);
