/* UI skin (Claude-owned, art pass). Pure CSS on top of the game's own HUD: one consistent "night glass"
 * look for the HUD, district label, toasts and round action buttons, and a smaller toast that sits near the
 * top in landscape so it stops covering the action. No layout logic or gameplay changes. */
(function (root) {
  'use strict';
  if (!root.document) return;
  const css = document.createElement('style');
  css.id = 'nsUiSkin';
  css.textContent = `
  :root{--ns-glass:#0c111ee6;--ns-line:#ffffff1f;--ns-text:#eef3fb;--ns-accent:#ffd970}
  #hud,#map{background:var(--ns-glass)!important;border:1px solid var(--ns-line)!important;box-shadow:0 6px 18px #0006,inset 0 1px 0 #ffffff12!important;color:var(--ns-text);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
  #hud b{letter-spacing:.02em}
  #toast{background:var(--ns-glass)!important;border:1px solid var(--ns-line);border-left:3px solid var(--ns-accent);box-shadow:0 10px 28px #0008;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    font-size:13px!important;line-height:1.35;max-width:min(560px,60vw);padding:9px 14px!important;border-radius:12px!important;color:var(--ns-text);pointer-events:none}
  @media (orientation:landscape){#toast{top:calc(52px + env(safe-area-inset-top,0px))!important}}
  @media (orientation:portrait){#toast{top:58%!important;max-width:min(360px,84vw)}}
  #actions button,#shoot,#pad,#aimPad{box-shadow:0 6px 16px #0007,inset 0 1px 0 #ffffff1a}
  #actions button{background:radial-gradient(circle at 50% 30%,#2b4566e6,#14223ae6)!important;border-color:#9fc3e055!important;letter-spacing:.03em}
  #actions button:active{transform:scale(.94)}
  `;
  document.head.appendChild(css);
})(typeof globalThis !== 'undefined' ? globalThis : this);
