'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {clusterKey}=require('../src/core');
test('native projection reuses legacy files and stable identity, excludes archived targets',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rancher-host-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 let handler;
 class Extension{async getExtensionFileFolder(){return root;}}
 class Ipc{static createInstance(){return new Ipc();}handle(channel,fn){assert.equal(channel,'request');handler=fn;}}
 globalThis.FreelensExtensionApi={Main:{LensExtension:Extension,Ipc}};
 const manifest=require('../package.json');
 const packaged=process.env.PACKAGED_EXTENSION_DIR||path.join(__dirname,'..');
 const Entry=require(path.join(packaged,manifest.main)).default;
 const dataPath=path.join(root,'rancher-catalog-v1');
 await fs.mkdir(dataPath);
 const id='persisted-server',clusterId='c-a',key=clusterKey(id,clusterId);
 const origin=path.join(dataPath,key+'.yaml');
 await fs.writeFile(origin,JSON.stringify({
   apiVersion:'v1',kind:'Config',clusters:[{name:'demo',cluster:{server:'https://api.example'}}],
   users:[{name:'demo',user:{token:'fake-test-token'}}],
   contexts:[{name:'demo',context:{cluster:'demo',user:'demo'}}],'current-context':'demo',
 }));
 await fs.writeFile(path.join(dataPath,'state.json'),JSON.stringify({version:1,servers:[{id,name:'Rancher',url:'https://rancher.example'}],records:[{key,clusterId,serverId:id,name:'Rancher demo'}]}));
 const ext=new Entry();await ext.onActivate();
 const get=()=>handler(null,'status');
 const before=await get();
 assert.equal(before.ok,true);
 const native=before.data.records[0].nativeKubeconfigPath;
 assert.equal(path.dirname(native),before.data.syncPath);
 assert.notEqual(native,origin);
 assert.match(await fs.readFile(native,'utf8'),/fake-test-token/);
 assert.equal((await fs.stat(native)).mode&0o777,0o600);
 assert.doesNotMatch(JSON.stringify(before),/fake-test-token/);
 const edited=await handler(null,'edit-cluster',{key,name:'New label'});assert.equal(edited.ok,true,edited.error);
 assert.equal((await get()).data.records[0].nativeKubeconfigPath,native);
 await handler(null,'archive',{id,approved:true});
 assert.deepEqual((await get()).data.records,[]);
 await assert.rejects(fs.stat(native),{code:'ENOENT'});
 assert.ok((await fs.stat(origin)).isFile());
 await handler(null,'restore',{id});
 assert.equal((await get()).data.records[0].nativeKubeconfigPath,native);
 await handler(null,'token',{id,token:'secret-from-input'});
 assert.doesNotMatch(JSON.stringify(await get()),/secret-from-input/);
 ext.onDeactivate();assert.equal(ext.service.tokens.size,0);
 const reloaded=new Entry();await reloaded.onActivate();
 assert.equal((await get()).data.records[0].name,'New label');
 assert.equal((await get()).data.records[0].nativeKubeconfigPath,native);
 reloaded.onDeactivate();
});
