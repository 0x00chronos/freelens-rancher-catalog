'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const {fixture}=require('./sdk-ipc-fixture');
test('real 1.10.3 Singleton rejects legacy new IPC and requires factory',()=>{const sdk=fixture();class BadIpc extends sdk.IpcMain{};assert.throws(()=>new BadIpc({}),/must be created by createInstance/);class BadRendererIpc extends sdk.IpcRenderer{};assert.throws(()=>new BadRendererIpc({}),/must be created by createInstance/);});
test('compiled main/renderer activate, invoke actual SDK IPC, disable and reactivate without duplicate handlers',async t=>{
 const sdk=fixture();const root=await fs.mkdtemp(path.join(os.tmpdir(),'rancher-sdk-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const manifest=require('../package.json');
 class MainExtension extends sdk.LensExtension {constructor(){super({logger:sdk.logger,ensureHashedDirectoryForExtension:async()=>root},{id:manifest.name,manifest,manifestPath:'/mock/package.json',isBundled:false});}addCatalogSource(){}removeCatalogSource(){}async navigate(){}}
 class RendererExtension extends sdk.LensExtension {constructor(){super({logger:sdk.logger,ensureHashedDirectoryForExtension:async()=>root},{id:manifest.name,manifest,manifestPath:'/mock/package.json',isBundled:false});}async navigate(){}}
 global.React=require('react');global.Mobx=require('mobx');global.LensExtensions={Main:{LensExtension:MainExtension,Ipc:sdk.IpcMain},Common:{Catalog:{KubernetesCluster:class{constructor(d){Object.assign(this,d);}}}},Renderer:{LensExtension:RendererExtension,Ipc:sdk.IpcRenderer,Component:{Input:({onChange,multiLine,...p})=>global.React.createElement(multiLine?'textarea':'input',{...p,onChange:e=>onChange(e.target.value)})},Catalog:{catalogEntities:{entities:new Map()}},Navigation:{navigate(){}}}};
 // PACKAGED_EXTENSION_DIR makes the same test execute unpacked npm artifact bytes.
 const packageRoot=process.env.PACKAGED_EXTENSION_DIR||path.join(__dirname,'..');const mainPath=path.join(packageRoot,'dist/main.js'),renderPath=path.join(packageRoot,'dist/renderer.js');delete require.cache[require.resolve(mainPath)];delete require.cache[require.resolve(renderPath)];const Main=require(mainPath).default,Renderer=require(renderPath).default;
 const React=require('react');const {act,create}=require('react-test-renderer');
 const main=new Main();const renderer=new Renderer();for(let cycle=0;cycle<3;cycle++){
  await main.activate();await main.enable();await renderer.activate();await renderer.enable();assert.equal(sdk.handlers.size,1);
  let ui;t.after(async()=>{if(ui)await act(async()=>ui.unmount());});await act(async()=>{ui=create(React.createElement(renderer.appPreferences[0].components.Input));});assert.ok(ui.root.findAllByProps({'data-testid':'rancher-panel'}).length);if(cycle===0)assert.ok(ui.root.findAllByType('input').some(n=>n.props.placeholder==='https://rancher.example.com'));else assert.ok(ui.root.findAllByType('select').length);assert.equal(ui.root.findAllByProps({role:'alert'}).length,0);
  if(cycle===0){const handler=[...sdk.handlers.values()][0];const saved=await handler({},'add',{name:'Persisted',url:'https://rancher.example'});assert.equal(saved.ok,true);}
  else assert.equal(main.service.servers[0].name,'Persisted');
  await act(async()=>ui.unmount());await renderer.disable();await main.disable();assert.equal(sdk.handlers.size,0);
 }
});
