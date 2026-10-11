/* Client integration for exact Claude RPG modules; no module internals modified. */
(function(root){'use strict';
function paused(){return ['#skPanel','#glPanel'].some(id=>root.document?.querySelector(id)?.hidden===false)||[root.NightshiftDailies,root.NightshiftWeapons,root.NightshiftCasino,root.NightshiftTuning,root.NightshiftHomeUpgrades].some(module=>module?.paused?.()===true)}
root.NightshiftRPG={paused};
})(globalThis);
