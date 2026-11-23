'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
test('compiled renderer imports as browser-compatible ESM with the FreeLens v2 global contract',async()=>{
 const React=require('react');
 let initialized=0;
 class Ipc {static createInstance(){initialized++;}}
 class Extension {}
 globalThis.FreelensExtensionApi={React,Renderer:{Ipc,LensExtension:Extension,Component:{}}};
 const manifest=require('../package.json');
 const root=process.env.PACKAGED_EXTENSION_DIR||path.join(__dirname,'..');
 const {default:Entry}=await import(pathToFileURL(path.join(root,manifest.renderer)));
 const extension=new Entry();extension.onActivate();
 assert.equal(initialized,1);
 assert.equal(typeof extension.globalPages[0].components.Page,'function');
});
