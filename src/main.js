'use strict';
const {Main}=globalThis.FreelensExtensionApi;
const {Service}=require('./service');
const {SafeError,sanitizeKubeconfig}=require('./core');
const path=require('node:path');
const fs=require('node:fs/promises');
const {randomUUID}=require('node:crypto');
const managedFile=/^[a-f0-9]{64}\.yaml$/;
class RancherMainIpc extends Main.Ipc {}
class RancherCatalogExtension extends Main.LensExtension {
  async onActivate() {
    // Keep the previous store name and data schema; FreeLens owns the hashed parent.
    this.service=new Service(path.join(await this.getExtensionFileFolder(),'rancher-catalog-v1'),()=>{});
    await this.service.init();
    this.syncPath=path.join(this.service.root,'native-kubeconfigs');
    await fs.mkdir(this.syncPath,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
    if(!(await fs.lstat(this.syncPath)).isDirectory())throw new SafeError('FreeLens 同步目录不安全');
    await fs.chmod(this.syncPath,0o700);
    this.projections=Promise.resolve();
    this.nativePaths=new Map();
    await this.projectNative();
    const ipc=RancherMainIpc.createInstance(this);
    ipc.handle('request',async (_event,action,payload={})=>{
      try {
        let data;
        switch(action) {
          case 'status':data=this.service.snapshot();break;
          case 'add':data=await this.service.addServer(payload);break;
          case 'edit':data=await this.service.editServer(payload.id,payload,payload.confirmOriginChange===true);break;
          case 'edit-cluster':data=await this.service.editCluster(payload.key,payload);break;
          case 'archive':data=await this.service.archiveServer(payload.id,payload.approved===true);break;
          case 'restore':data=await this.service.restoreServer(payload.id);break;
          case 'token':data=this.service.setToken(payload.id,payload.token);break;
          case 'clear-token':data=this.service.clearToken(payload.id);break;
          case 'sync':data=await this.service.sync(payload.id,payload.approved===true,payload.refresh===true,payload.clusterIds||[]);break;
          case 'cancel':data=this.service.cancel();break;
          default:throw new SafeError('未知操作');
        }
        if(['edit','archive','restore','sync'].includes(action)){
          await this.projectNative();
          data={...data,...this.service.snapshot()};
        }
        return {ok:true,data:{...data,syncPath:this.syncPath,records:data.records.map(r=>({...r,nativeKubeconfigPath:this.nativePaths.get(r.key)}))}};
      }catch(e){const error=e instanceof SafeError ? e.message : '操作失败；请检查插件数据与 FreeLens 同步目录权限';if(action==='sync')this.service.message=error;return {ok:false,error};}
    });
  }
  projectNative() {
    // Only the native kubeconfig watcher registers real, proxy-backed clusters.
    const update=this.projections.catch(()=>{}).then(async()=>{
      const active=new Map();
      for(const r of this.service.snapshot().records){
        if(r.available===false)continue;
        const source=this.service.configPath(r.key);
        const stat=await fs.lstat(source);
        if(!stat.isFile()||stat.isSymbolicLink())throw new SafeError('保存的 kubeconfig 路径不安全');
        const config=sanitizeKubeconfig(await fs.readFile(source,'utf8')).text;
        const dest=path.join(this.syncPath,`${r.key}.yaml`);
        let previous;
        try{
          if(!(await fs.lstat(dest)).isFile())throw new SafeError('FreeLens kubeconfig 路径不安全');
          previous=await fs.readFile(dest,'utf8');await fs.chmod(dest,0o600);
        }catch(e){if(e.code!=='ENOENT')throw e;}
        if(previous!==config){
          // Stage outside the watched folder so the temporary file cannot create duplicate clusters.
          const tmp=path.join(this.service.root,`native-${randomUUID()}.tmp`);
          try{await fs.writeFile(tmp,config,{flag:'wx',mode:0o600});await fs.rename(tmp,dest);}
          finally{await fs.unlink(tmp).catch(()=>{});}
        }
        active.set(r.key,dest);
      }
      const activeFiles=new Set([...active.values()].map(p=>path.basename(p)));
      for(const entry of await fs.readdir(this.syncPath,{withFileTypes:true})){
        if(managedFile.test(entry.name)&&!activeFiles.has(entry.name)&&entry.isFile())await fs.unlink(path.join(this.syncPath,entry.name));
      }
      this.nativePaths=active;
    });
    this.projections=update;
    return update;
  }
  onDeactivate(){this.service?.deactivate();}
}
module.exports={default:RancherCatalogExtension};
