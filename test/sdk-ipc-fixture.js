'use strict';
// Executes the actual published @freelensapp/core 1.10.3 IPC/Singleton code.
// Imports for Electron and DI are supplied as isolated in-memory boundaries.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const mobx=require('mobx');
function load(name,bindings,names){const source=fs.readFileSync(path.join(__dirname,'fixtures/sdk-1.10.3',name+'.js.txt'),'utf8').replace(/^import .*;\n/gm,'').replace(/^export default .*;\n/gm,'').replace(/\bexport /g,'');return new Function(...Object.keys(bindings),source+`;return {${names}};`)(...Object.values(bindings));}
function fixture(){
 const {Singleton}=load('singleton',{},'Singleton');
 function disposer(){let callbacks=[];const f=()=>{for(const c of callbacks.splice(0))c();};f.push=c=>callbacks.push(c);return f;}
 const {LensExtension,Disposers}=load('lens-extension',{disposer,...mobx},'LensExtension,Disposers');
 const {IpcRegistrar,IpcPrefix}=load('ipc-registrar',{Singleton,createHash:crypto.createHash,broadcastMessage:()=>{}},'IpcRegistrar,IpcPrefix');
 const handlers=new Map();const logger={debug(){},info(){},error(){}};
 const ipcMain={removeHandler(channel){handlers.delete(channel);},addListener(){},removeListener(){}};
 const ipcMainHandle=(channel,handler)=>{if(handlers.has(channel))throw new Error('Attempted to register a second handler');handlers.set(channel,handler);};
 const ipcRenderer={async invoke(channel,...args){const handler=handlers.get(channel);if(!handler)throw new Error('No handler registered');return handler({},...args);},addListener(){},removeListener(){}};
 const once=fn=>{let called=false;return(...args)=>{if(!called){called=true;return fn(...args);}};};
 const {IpcMain}=load('ipc-main',{IpcRegistrar,IpcPrefix,Disposers,ipcMain,ipcMainHandle,once,getEnvironmentSpecificLegacyGlobalDiForExtensionApi:()=>({inject:()=>logger}),loggerInjectionToken:{}},'IpcMain');
 const {IpcRenderer}=load('ipc-renderer',{IpcRegistrar,IpcPrefix,Disposers,ipcRenderer,once,console},'IpcRenderer');
 return {Singleton,LensExtension,Disposers,IpcMain,IpcRenderer,handlers,logger};
}
module.exports={fixture};
