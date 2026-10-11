// Package only the playable assets; fail before replacing an existing build.
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'..'),output=path.join(source,'dist');
function assets(html){
 const names=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
 if(!names.length)throw Error('No game scripts found');
 if(names.some(name=>!/^[a-z0-9-]+\.js$/i.test(name)))throw Error('Only local root JavaScript assets are supported');
 if(new Set(names).size!==names.length)throw Error('Duplicate game script');
 return ['index.html',...names];
}
function build(){
 const files=assets(fs.readFileSync(path.join(source,'index.html'),'utf8'));
 const contents=files.map(name=>[name,fs.readFileSync(path.join(source,name))]);
 fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output);
 for(const [name,content] of contents)fs.writeFileSync(path.join(output,name),content);
 console.log(`Built ${files.length} playable assets in dist`);
 return files;
}
module.exports={assets,build};if(require.main===module)build();
