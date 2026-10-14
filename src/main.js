'use strict';
const { Main, Common } = global.LensExtensions;
const {observable,runInAction}=global.Mobx;
const {Service}=require('./service');
const {SafeError}=require('./core');
const path=require('node:path');
class RancherMainIpc extends Main.Ipc {}
class RancherCatalogExtension extends Main.LensExtension {
  constructor(...args) {
    super(...args);
    this.entities=observable.array([],{deep:false});
    this.appMenus=[{parentId:'file',label:'Rancher Catalog',click:()=>this.navigate('rancher-catalog')}];
  }
  async onActivate() {
    this.service=new Service(path.join(await this.getExtensionFileFolder(),'rancher-catalog-v1'),(records,servers)=>{
      const entities=records.filter(r=>r.available!==false).flatMap(r=>r.contexts.map(context=>new Common.Catalog.KubernetesCluster({
        metadata:{uid:`rancher-${r.key}-${require('node:crypto').createHash('sha256').update(context).digest('hex')}`, name:`${r.name}${r.contexts.length>1 ? ` / ${context}` : ''}`,source:'Rancher',labels:{'rancher/server':servers.find(s=>s.id===r.serverId)?.name || r.serverId,'rancher/cluster-id':r.clusterId,'rancher/stale':String(r.stale)}},
        spec:{kubeconfigPath:this.service.configPath(r.key),kubeconfigContext:context},status:{phase:'disconnected'}
      })));
      runInAction(()=>{
        const previous=new Map(this.entities.map(entity=>[entity.metadata.uid,entity]));
        this.entities.replace(entities.map(entity=>{const old=previous.get(entity.metadata.uid);if(!old)return entity;old.metadata=entity.metadata;old.spec=entity.spec;return old;}));
      });
    });
    await this.service.init(); this.addCatalogSource('rancher-catalog',this.entities);
    const ipc=RancherMainIpc.createInstance(this);
    ipc.handle('request',async (_event,action,payload={})=>{
      try {
        let data;
        switch(action) {
          case 'status':data=this.service.snapshot();break;
          case 'add':data=await this.service.addServer(payload);break;
          case 'edit':data=await this.service.editServer(payload.id,payload,payload.confirmOriginChange===true);break;
          case 'archive':data=await this.service.archiveServer(payload.id,payload.approved===true);break;
          case 'restore':data=await this.service.restoreServer(payload.id);break;
          case 'token':data=this.service.setToken(payload.id,payload.token);break;
          case 'clear-token':data=this.service.clearToken(payload.id);break;
          case 'sync':data=await this.service.sync(payload.id,payload.approved===true,payload.refresh===true,payload.clusterIds||[]);break;
          case 'cancel':data=this.service.cancel();break;
          default:throw new SafeError('未知操作');
        }
        return {ok:true,data};
      }catch(e){const error=e instanceof SafeError ? e.message : '操作失败；已有配置保留，请检查插件目录权限';if(action==='sync')this.service.message=error;return {ok:false,error};}
    });
  }
  onDeactivate(){this.service?.deactivate();this.removeCatalogSource('rancher-catalog');runInAction(()=>this.entities.clear());}
}
module.exports={default:RancherCatalogExtension};
