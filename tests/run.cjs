const fs=require('node:fs'),cp=require('node:child_process');
const files=['boot','glovebox','camera','audio','v15-persistence','safe-zones','courier-routes','signals','roads','environment','progression','salvage','movement','feedback','build','input','guidance','menus','simulation','backups','clock','city-map','traffic','vehicles','navigation','combat','inventory','recovery','activities','crime','smoke','home','persistence'];
for(const file of fs.readdirSync('.').filter(x=>x.endsWith('.js'))){const r=cp.spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
for(const name of files){const r=cp.spawnSync(process.execPath,[`tests/${name}.cjs`],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
console.log(`PASS: ${files.length} suites and module syntax checks`);
