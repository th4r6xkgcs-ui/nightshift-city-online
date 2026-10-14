/* Persistent named-contact familiarity. Pricing and inventories remain elsewhere. */
(function(root){'use strict';
const KEY='nightshift-city-npc-memory-v1',IDS=['south-recruiter','docks-recruiter','west-buyer','docks-buyer',...root.NightshiftBusinessRules.CUSTOMERS.map(c=>'customer-'+c.id)],DELTAS={meet:0,trade:2,help:4,gang:3,disturbance:-3};
function clean(raw={},now=Date.now()){const people={};for(const id of IDS){const p=raw?.people?.[id]||{},count=k=>Number.isSafeInteger(p[k])?Math.max(0,Math.min(1000000,p[k])):0;people[id]={trust:Number.isSafeInteger(p.trust)?Math.max(-100,Math.min(100,p.trust)):0,visits:count('visits'),trades:count('trades'),help:count('help'),incidents:count('incidents'),lastAt:Number.isSafeInteger(p.lastAt)&&p.lastAt>=0?Math.min(p.lastAt,now):0,lastIncidentAt:Number.isSafeInteger(p.lastIncidentAt)&&p.lastIncidentAt>=0?Math.min(p.lastIncidentAt,now):0}}return {version:1,people}}
function remember(state,id,kind,now=Date.now()){const p=state.people[id];if(!IDS.includes(id)||!p||!Object.hasOwn(DELTAS,kind)||!Number.isSafeInteger(now)||now<0)return false;if(kind==='disturbance'&&p.incidents&&now-p.lastIncidentAt<15000)return false;
p.trust=Math.max(-100,Math.min(100,p.trust+DELTAS[kind]));p.lastAt=now;const key=kind==='meet'?'visits':kind==='trade'?'trades':kind==='help'?'help':kind==='disturbance'?'incidents':null;if(key)p[key]=Math.min(1000000,p[key]+1);if(kind==='disturbance')p.lastIncidentAt=now;return true}
function relation(p){return p.trust<=-10?'WARY':p.trust>=10?'FAMILIAR':p.visits||p.trades?'RECOGNIZES YOU':'NEW FACE'}
root.NightshiftMemory={KEY,IDS,clean,remember,relation};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function note(id,kind){if(remember(state,id,kind)){persist();return true}return false}
function meet(id){return note(id,'meet')}
function describe(id){const p=state.people[id];if(!p)return '';return relation(p)+' · trust '+p.trust+' · '+p.trades+' trades · '+p.help+' favors'+(p.incidents?' · remembers '+p.incidents+' disturbance'+(p.incidents===1?'':'s'):'')}
function disturbance(source,kind,radius=260){if(![source?.x,source?.y,radius].every(Number.isFinite)||radius<0)return;let count=0;for(const c of root.NightshiftGangLife?.CONTACTS||[])if(Math.hypot(c.x-source.x,c.y-source.y)<=radius&&note(c.id,'disturbance'))count++;if(count)root.NightshiftJournal?.record('incident',count+' street contact'+(count===1?'':'s')+' remembered '+kind)}
function greeting(id){const p=state.people[id];if(!p)return '';const r=relation(p);return r==='FAMILIAR'?'“Good to see you again. You show up for people.”':r==='WARY'?'“I remember the trouble around you. Keep it calm this time.”':r==='RECOGNIZES YOU'?'“Back again? I remember you. What do you need?”':'“New face. What brings you to this corner?”'}
Object.assign(root.NightshiftMemory,{state,save:persist,note,meet,describe,disturbance,greeting});root.addEventListener('pagehide',persist);
})(globalThis);
