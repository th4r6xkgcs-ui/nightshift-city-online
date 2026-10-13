/* Client integration for exact Claude RPG modules; no module internals modified. */
(function(root){'use strict';
function paused(){return ['#skPanel','#glPanel'].some(id=>root.document?.querySelector(id)?.hidden===false)||[root.NightshiftStudio,root.NightshiftHeists,root.NightshiftVenues,root.NightshiftEmpire,root.NightshiftEvents,root.NightshiftStashes,root.NightshiftMarket,root.NightshiftLife,root.NightshiftSupply,root.NightshiftFood,root.NightshiftCars,root.NightshiftPets,root.NightshiftChop,root.NightshiftDreamHome,root.NightshiftCarMeet,root.NightshiftSafehouse,root.NightshiftJournal,root.NightshiftJobs,root.NightshiftFishing,root.NightshiftLab,root.NightshiftGangLife,root.NightshiftDailies,root.NightshiftWeapons,root.NightshiftCasino,root.NightshiftTuning,root.NightshiftHomeUpgrades].some(module=>module?.paused?.()===true)}
root.NightshiftRPG={paused};
})(globalThis);
