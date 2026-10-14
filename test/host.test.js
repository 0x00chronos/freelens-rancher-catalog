'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
test('compiled main bundle matches 1.10.3 public API, reuses entity identity, cleans source on disable',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'rancher-host-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));let handler;let removed=false;let source;
  class Extension{async getExtensionFileFolder(){return root;}addCatalogSource(id,value){assert.equal(id,'rancher-catalog');source=value;}removeCatalogSource(){removed=true;}async navigate(){}}
  class Ipc extends require('./fixtures/sdk-1.10.3/singleton.cjs'){handle(channel,fn){assert.equal(channel,'request');handler=fn;}}
  class Cluster{constructor(data){Object.assign(this,data);assert.equal(typeof data.spec.kubeconfigPath,'string');assert.equal(typeof data.spec.kubeconfigContext,'string');}getId(){return this.metadata.uid;}}
  global.Mobx=require('mobx');global.LensExtensions={Main:{LensExtension:Extension,Ipc},Common:{Catalog:{KubernetesCluster:Cluster}}};
  delete require.cache[require.resolve('../dist/main')];const Entry=require('../dist/main').default;const ext=new Entry();await ext.onActivate();assert.ok(source);const added=await handler(null,'add',{name:'Demo',url:'https://rancher.example'});assert.equal(added.ok,true);const id=added.data.servers[0].id;await handler(null,'token',{id,token:'SECRET'});assert.equal(JSON.stringify((await handler(null,'status')).data).includes('SECRET'),false);
  const r={key:'a'.repeat(64),serverId:id,clusterId:'a',name:'A',contexts:['demo'],available:true};ext.service.publish([r],ext.service.servers);const entity=source[0];entity.status.phase='connected';ext.service.publish([{...r,name:'Updated'}],ext.service.servers);assert.equal(source[0],entity);assert.equal(source[0].status.phase,'connected');assert.equal(source[0].metadata.name,'Updated');ext.onDeactivate();assert.equal(removed,true);assert.equal(source.length,0);assert.equal(ext.service.tokens.size,0);
});
test('compiled renderer confirms sync, clears token input, switches server and connects via public navigation',async t=>{
  const React=require('react');const TestRenderer=require('react-test-renderer');const {act}=TestRenderer;const calls=[];let navigated;
  const state={servers:[{id:'one',name:'One',url:'https://one.example',hasToken:false},{id:'two',name:'Two',url:'https://two.example',hasToken:false}],records:[{key:'key',serverId:'one',clusterId:'c-a',name:'A',contexts:['demo'],kubeconfigPath:'/private/key.yaml',updatedAt:'2026-10-14T00:00:00Z'}],busy:false,message:'',root:'/private'};
  class Extension{navigate(){}}class Ipc extends require('./fixtures/sdk-1.10.3/singleton.cjs'){async invoke(channel,action,payload){calls.push({action,payload});if(action==='token')state.servers.find(s=>s.id===payload.id).hasToken=true;return {ok:true,data:structuredClone(state)};}}
  // Public SDK wrapper intentionally has no onRun method.
  const NativeInput=({onChange,multiLine,...props})=>React.createElement(multiLine?'textarea':'input',{...props,onChange:e=>onChange(e.target.value)});
  global.React=React;global.LensExtensions={Renderer:{Component:{Input:NativeInput},LensExtension:Extension,Ipc,Navigation:{navigate:x=>navigated=x},Catalog:{catalogEntities:{entities:new Map([['entity',{metadata:{source:'Rancher'},spec:{kubeconfigPath:'/private/key.yaml',kubeconfigContext:'demo'},getId:()=> 'entity'}]])}}}};
  delete require.cache[require.resolve('../dist/renderer')];const Entry=require('../dist/renderer').default;const ext=new Entry();ext.onActivate();let render;t.after(async()=>{if(render)await act(async()=>render.unmount());});await act(async()=>{render=TestRenderer.create(React.createElement(ext.globalPages[0].components.Page));});
  const button=(text)=>render.root.findAllByType('button').find(b=>b.children.join('').includes(text));
  const route=render.root.findByProps({'data-testid':'rancher-route'});assert.equal(route.props.style.position,'relative');assert.ok(route.props.style.zIndex>1);assert.equal(route.props.style.flex,1);assert.equal(render.root.findAllByType('main').length,0);
  assert.equal(button('同步集群').props.disabled,true);
  const secret=()=>render.root.findAllByType('input').find(x=>x.props.type==='password');
  await act(async()=>secret().props.onChange({target:{value:'test-secret'}}));await act(async()=>button('设置 Token').props.onClick());assert.equal(secret().props.value,'');assert.equal(button('同步集群').props.disabled,true);
  let checkboxes=render.root.findAllByProps({type:'checkbox'});await act(async()=>checkboxes[0].props.onChange({target:{checked:true}}));assert.equal(button('同步集群').props.disabled,false);await act(async()=>button('同步集群').props.onClick());assert.equal(calls.filter(c=>c.action==='sync').length,1);assert.equal(calls.find(c=>c.action==='sync').payload.approved,true);assert.equal(render.root.findAllByProps({type:'checkbox'})[0].props.checked,false);
  await act(async()=>render.root.findByType('select').props.onChange({target:{value:'two'}}));assert.equal(secret().props.value,'');assert.equal(button('同步集群').props.disabled,true);
  await act(async()=>render.root.findByType('select').props.onChange({target:{value:'one'}}));
  await act(async()=>button('连接：').props.onClick());assert.equal(navigated,'/cluster/entity');await act(async()=>render.unmount());
  await act(async()=>{render=TestRenderer.create(React.createElement(ext.appPreferences[0].components.Input));});
  await act(async()=>button('添加实例').props.onClick());
  assert.ok(render.root.findAllByType('input').some(x=>x.props.placeholder==='https://rancher.example.com'));
  assert.ok(render.root.findAllByType('input').some(x=>x.props.type==='password'));
  assert.ok(button('同步集群'));
  assert.equal(render.root.findByProps({'data-testid':'rancher-panel'}).props.style.padding,0);
  await act(async()=>render.unmount());
});
test('failed IPC initialization stops polling, ends loading and allows explicit retry',async t=>{
 const React=require('react');const {act,create}=require('react-test-renderer');let stopped=0;let statusCalls=0;t.mock.method(global,'setInterval',()=>123);t.mock.method(global,'clearInterval',()=>stopped++);
 class Extension{}class Ipc extends require('./fixtures/sdk-1.10.3/singleton.cjs'){async invoke(){statusCalls++;return {ok:true,data:{servers:[],records:[],root:'/mock',busy:false,message:''}};}}
 global.React=React;global.LensExtensions={Renderer:{LensExtension:Extension,Ipc,Component:{Input:({onChange,...p})=>React.createElement('input',{...p,onChange:e=>onChange(e.target.value)})}}};delete require.cache[require.resolve('../dist/renderer')];const Entry=require('../dist/renderer').default;const ext=new Entry();let ui;
 await act(async()=>{ui=create(React.createElement(ext.appPreferences[0].components.Input));});assert.equal(statusCalls,0);assert.ok(stopped>=1);assert.match(ui.root.findByProps({role:'alert'}).children[0],/通信未初始化/);assert.match(ui.root.findByProps({role:'status'}).children[0],/配置加载失败/);
 ext.onActivate();await act(async()=>ui.root.findAllByType('button').find(b=>b.children.includes('重试加载')).props.onClick());assert.equal(statusCalls,1);assert.equal(ui.root.findAllByProps({role:'alert'}).length,0);assert.ok(ui.root.findAllByType('input').length>0);await act(async()=>ui.unmount());
});
