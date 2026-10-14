'use strict';
const fs=require('node:fs');const cp=require('node:child_process');
for(const folder of ['src','scripts','test'])for(const f of fs.readdirSync(folder))if(f.endsWith('.js'))cp.execFileSync(process.execPath,['--check',`${folder}/${f}`],{stdio:'inherit'});
console.log('JavaScript syntax checks passed');
