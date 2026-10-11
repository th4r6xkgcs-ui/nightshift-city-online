/* Curated customer requests share the city's existing dealer demand and ledger. */
(function(root){'use strict';
const KEY='nightshift-city-customers-v1',WAIT=90000,CUSTOMERS=root.NightshiftBusinessRules.CUSTOMERS;
function clean(raw={},now=Date.now()){const ready={};for(const c of CUSTOMERS){const n=raw?.ready?.[c.id];ready[c.id]=Number.isSafeInteger(n)&&n>=0?Math.min(n,now+WAIT):0}return {version:1,ready,completed:Number.isSafeInteger(raw?.completed)?Math.max(0,Math.min(1000000,raw.completed)):0}}
function deal(state,business,actor,pocket,id,now=Date.now(),refusal=null){
 const c=CUSTOMERS.find(c=>c.id===id),fail=reason=>({ok:false,reason});if(!c||!Number.isSafeInteger(now)||now<0)return fail('Unknown customer');if(refusal)return fail(refusal);if(now<state.ready[id])return fail('Customer returns in '+Math.ceil((state.ready[id]-now)/1000)+'s');
 const result=root.NightshiftBusinessRules.transact(business,actor,pocket,{id:c.market,customer:c.id,action:'sell',item:c.item,count:c.count},now);
 if(result.ok){state.ready[id]=now+WAIT;state.completed=Math.min(1000000,state.completed+1);result.message=c.name+' bought '+c.count+' '+c.item+' · '+result.message}return result;
}
root.NightshiftCustomers={KEY,WAIT,CUSTOMERS,clean,deal};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function perform(id){const c=CUSTOMERS.find(c=>c.id===id);if(!root.NightshiftGangLife.paused()||!c||Math.hypot(player.x-c.x,player.y-c.y)>50||root.NightshiftNavigation.trace(player,c,blocked))return {ok:false,reason:'Meet this customer on foot'};
 const now=Date.now();root.NightshiftBusinessRules.advance(root.NightshiftBusinesses.state,now);
 const result=deal(state,root.NightshiftBusinesses.state,player,root.NightshiftInventory.state.pocket,id,now,root.NightshiftCrews.marketAccess(c.market));if(result.ok){root.NightshiftCrime?.report(c,performance.now(),'street-deal');persist();root.NightshiftBusinesses.save();save()}return result;
}
function controls(parent,contact){
 const c=CUSTOMERS.find(c=>c.id===contact?.customer);if(!c)return;const doc=root.document,add=(tag,t)=>{const n=doc.createElement(tag);n.textContent=t;parent.appendChild(n);return n},market=root.NightshiftBusinessRules.market(c.market),unit=Math.round(market.sell[c.item]*c.premium),ready=Math.max(0,Math.ceil((state.ready[c.id]-Date.now())/1000)),remaining=root.NightshiftBusinessRules.DEMAND[c.item]-root.NightshiftBusinesses.state.markets[c.market].sold[c.item];
 add('blockquote','“Bring '+c.count+' carried '+c.item+'. I pay for convenience, but the local market has limits.”');add('p','Offer $'+unit*c.count+' · '+c.count+' '+c.item+' · carried '+(root.NightshiftInventory.state.pocket[c.item]||0));add('p',market.name+' demand remaining '+remaining+' · customer '+(ready?'returns in '+ready+'s':'ready'));
 const b=add('button','Fulfill request · +$'+unit*c.count);b.type='button';b.addEventListener('click',()=>root.NightshiftGangLife.perform({action:'customer-sale'}));
 add('p','Shares dealer demand and the existing sales ledger. Heat increases on handoff; heat 2+ or hostile local reputation blocks the deal. Goods stay in your pockets until sold and drop on death. Customer returns every 90 seconds; dealer demand refills on its existing schedule.');
}
Object.assign(root.NightshiftCustomers,{state,save:persist,perform,controls});root.addEventListener('pagehide',persist);
})(globalThis);
