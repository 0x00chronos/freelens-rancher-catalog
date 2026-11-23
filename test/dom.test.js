'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const esbuild=require('esbuild');const {JSDOM,VirtualConsole}=require('jsdom');
async function until(fn){for(let i=0;i<100;i++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,10));}throw new Error('DOM condition timed out');}
test('DOM host follows real route shape, inline preferences, native Input events and safe sync',async t=>{
 const bundle=await esbuild.build({entryPoints:['test/browser-harness.jsx'],write:false,bundle:true,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'},jsxFactory:'React.createElement'});
 const errors=[];const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://mock.local/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console});t.after(()=>dom.window.close());dom.window.structuredClone=structuredClone;dom.window.eval(bundle.outputFiles[0].text);const d=dom.window.document;
 const button=name=>[...d.querySelectorAll('button')].find(e=>e.textContent.trim()===name);await until(()=>button('Welcome → Rancher Catalog'));button('Welcome → Rancher Catalog').click();await until(()=>d.querySelector('[data-testid=rancher-route]'));
 assert.equal(dom.window.location.pathname,'/extension/freelens-rancher-catalog/rancher-catalog');const route=d.querySelector('[data-testid=rancher-route]');assert.equal(route.style.zIndex,'2');assert.equal(route.style.position,'relative');assert.equal(d.querySelectorAll('main main').length,0);
 button('Preferences').click();await until(()=>d.querySelector('.preferences input[placeholder="https://rancher.example.com"]'));
 function input(selector,value){const el=d.querySelector(selector);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}
 input('input[placeholder="例如：生产 Rancher"]','DOM Rancher');input('input[placeholder="https://rancher.example.com"]','https://rancher.example');d.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await until(()=>d.querySelector('input[type=password]'));
 assert.equal(d.querySelector('select option').textContent,'DOM Rancher · https://rancher.example');input('input[type=password]','mock-secret');await until(()=>!button('设置 Token').disabled);button('设置 Token').click();await until(()=>d.querySelector('input[type=password]').value==='');assert.equal(button('同步集群').disabled,true);
 d.querySelectorAll('input[type=checkbox]')[0].click();await until(()=>!button('同步集群').disabled);button('同步集群').click();await until(()=>d.body.textContent.includes('Demo cluster'));assert.equal(d.querySelectorAll('input[type=checkbox]')[0].checked,false);assert.equal(dom.window.calls.filter(c=>c.action==='sync').length,1);
 button('修改插件显示名').click();await until(()=>d.querySelector('input[aria-label="集群显示名称"]'));
 input('input[aria-label="集群显示名称"]','Discarded alias');button('取消编辑').click();await until(()=>!button('保存集群'));assert.equal(dom.window.calls.filter(c=>c.action==='edit-cluster').length,0);
 button('修改插件显示名').click();await until(()=>button('保存集群'));
 input('input[aria-label="集群显示名称"]','My cluster');d.querySelector('form[aria-label="编辑已同步集群"]').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await until(()=>d.body.textContent.includes('My cluster')&&!button('保存集群'));
 assert.deepEqual(JSON.parse(JSON.stringify(dom.window.calls.filter(c=>c.action==='edit-cluster'))),[{action:'edit-cluster',payload:{key:'fixture',name:'My cluster'}}]);
 d.querySelectorAll('input[type=checkbox]')[0].click();await until(()=>!button('同步集群').disabled);button('同步集群').click();await until(()=>button('修改插件显示名').disabled);await until(()=>!button('修改插件显示名').disabled);assert.equal(d.querySelectorAll('article').length,1);assert.ok(d.body.textContent.includes('My cluster'));
 const previousRoute=dom.window.location.pathname;
 dom.window.nativeClusters=[{id:'wrong-file',kubeConfigPath:'/tmp/other.yaml',contextName:'demo'},{id:'wrong-context',kubeConfigPath:'/mock/native/demo.yaml',contextName:'wrong'}];
 button('集群设置').click();await until(()=>d.querySelector('[role=alert]')?.textContent.includes('尚未导入'));
 assert.equal(dom.window.location.pathname,previousRoute);
 dom.window.nativeClusters.push({id:'native/id',status:'disconnected',kubeConfigPath:'/mock/native/demo.yaml',contextName:'demo'});
 const writeCalls=()=>dom.window.calls.filter(c=>c.action!=='status').length;
 const beforeSettings=writeCalls();
 button('集群设置').click();await until(()=>dom.window.location.pathname==='/entity/native%2Fid/settings');
 assert.equal(writeCalls(),beforeSettings,'settings navigation must not use plugin mutation IPC');
 button('Preferences').click();await until(()=>d.querySelector('.preferences')&&button('连接：demo'));
 button('连接：demo').click();await until(()=>dom.window.location.pathname==='/cluster/native%2Fid');
 button('Preferences').click();await until(()=>d.querySelector('.preferences')&&button('修改插件显示名')&&!button('修改插件显示名').disabled);button('修改插件显示名').click();await until(()=>button('保存集群'));
 input('input[aria-label="集群显示名称"]','');d.querySelector('form[aria-label="编辑已同步集群"]').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await until(()=>d.body.textContent.includes('Demo cluster')&&!button('保存集群'));
 button('编辑').click();await until(()=>d.querySelector('form'));input('input[placeholder="例如：生产 Rancher"]','Renamed');d.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await until(()=>d.querySelector('select option').textContent.includes('Renamed'));button('删除实例').click();await until(()=>button('确认归档'));button('取消').click();await until(()=>!button('确认归档'));assert.ok(d.querySelector('select'));button('删除实例').click();await until(()=>button('确认归档'));button('确认归档').click();await until(()=>button('恢复实例'));assert.equal(d.querySelector('select'),null);button('恢复实例').click();await until(()=>d.querySelector('select'));assert.ok(d.querySelector('select option').textContent.includes('Renamed'));assert.equal(button('同步集群').disabled,true);
 button('Welcome → Rancher Catalog').click();await until(()=>d.querySelector('[data-testid=rancher-route]'));assert.equal(dom.window.location.pathname,'/extension/freelens-rancher-catalog/rancher-catalog');assert.deepEqual(errors,[]);
});
