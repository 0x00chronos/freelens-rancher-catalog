'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {SafeError, fail, str, obj, serverUrl, clusterKey, discover, generate, sanitizeKubeconfig} = require('./core');
async function atomicWrite(file, data) {
  // Owned directory only. Never follow a target symlink and never truncate an existing file.
  try { const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) fail('数据路径不是普通文件'); } catch(e) { if(e.code !== 'ENOENT') throw e; }
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  try { await fs.writeFile(tmp, data, {mode:0o600, flag:'wx'}); await fs.rename(tmp,file); } finally { await fs.unlink(tmp).catch(()=>{}); }
}
class Service {
  constructor(root, publish, transport) { this.root=root; this.publish=publish; this.transport=transport; this.servers=[]; this.records=[]; this.tokens=new Map(); this.busy=false; this.mutating=false; this.summary=null; this.active=true; this.controller=null; this.message=''; }
  async init() {
    await fs.mkdir(this.root,{recursive:true,mode:0o700});
    const rootStat = await fs.lstat(this.root); if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('插件数据目录不安全');
    await fs.chmod(this.root,0o700);
    let raw;
    try {const stateFile=path.join(this.root,'state.json');const stat=await fs.lstat(stateFile);if(!stat.isFile()||stat.isSymbolicLink())fail('索引路径不安全');raw=await fs.readFile(stateFile,'utf8');} catch(e) {if(e.code!=='ENOENT')throw e;}
    if(raw!==undefined) try {
      const saved=JSON.parse(raw);
      if(saved.version!==1 || !Array.isArray(saved.servers) || !Array.isArray(saved.records)) fail('保存的数据格式不兼容');
      this.servers=saved.servers.map(s=>this.validateServer(s,true));
      for(const r of saved.records) {
        if(!obj(r) || !this.servers.some(s=>s.id===r.serverId) || !/^[a-f0-9]{64}$/.test(r.key) || r.key!==clusterKey(r.serverId,r.clusterId)) fail('保存的集群索引无效');
        try {
          const fileStat=await fs.lstat(this.configPath(r.key));
          if(!fileStat.isFile() || fileStat.isSymbolicLink())fail('保存的配置不是普通文件');
          await fs.chmod(this.configPath(r.key),0o600);
          const parsed=sanitizeKubeconfig(await fs.readFile(this.configPath(r.key),'utf8'));
          this.records.push({...r,contexts:parsed.contexts,available:true});
        } catch {
          this.records.push({...r,contexts:[],available:false});
          this.message+='部分已保存 kubeconfig 缺失或无法安全读取；已保留索引，重新同步可修复。\n';
        }
      }
    } catch { this.servers=[]; this.records=[]; fail('读取已保存配置失败；原文件保留，请备份后检查数据目录'); }
    this.emit();
  }
  configPath(key) { if(!/^[a-f0-9]{64}$/.test(key)) fail('配置 ID 无效'); return path.join(this.root,`${key}.yaml`); }
  validateServer(s,existing=false) {
    if(!obj(s)) fail('服务器配置无效');
    const result={id: existing ? str(s.id,'服务器 ID',100) : crypto.randomUUID(), name:str(s.name,'服务器名称',100),url:serverUrl(s.url),ca:''};
    if(s.ca) { if(typeof s.ca!=='string'||s.ca.length>256*1024||!s.ca.includes('-----BEGIN CERTIFICATE-----')) fail('CA 必须为 PEM 证书'); result.ca=s.ca; }
    if(existing && s.archivedAt) result.archivedAt=str(s.archivedAt,'归档时间',100);
    return result;
  }
  emit() { if(!this.active)return;const active=this.servers.filter(s=>!s.archivedAt);const ids=new Set(active.map(s=>s.id));this.publish(this.records.filter(r=>ids.has(r.serverId)),active); }
  async save() { await atomicWrite(path.join(this.root,'state.json'),JSON.stringify({version:1,servers:this.servers,records:this.records},null,2)); }
  snapshot() {
    const active=this.servers.filter(s=>!s.archivedAt);const ids=new Set(active.map(s=>s.id));
    return {servers:active.map(s=>({...s,hasToken:this.tokens.has(s.id)})),archives:this.servers.filter(s=>s.archivedAt).map(s=>({...s,clusterCount:this.records.filter(r=>r.serverId===s.id).length})),records:this.records.filter(r=>ids.has(r.serverId)).map(r=>({...r,kubeconfigPath:this.configPath(r.key)})),busy:this.busy||this.mutating,message:this.message,summary:this.summary,root:this.root};
  }
  async mutate(change) {
    if(this.busy||this.mutating) fail('操作进行中，请稍后重试');
    if(!this.active) fail('扩展已停用');
    this.mutating=true;const previous=this.servers.map(s=>({...s}));
    try {const result=change();await this.save();this.emit();return result;}
    catch(e){this.servers=previous;throw e;}finally{this.mutating=false;}
  }
  async addServer(value) {
    const s=this.validateServer(value);
    await this.mutate(()=>{const duplicate=this.servers.find(x=>x.url===s.url);if(duplicate)fail(duplicate.archivedAt?'该地址已有归档实例，请从归档列表恢复以复用凭据':'该 Rancher 地址已存在');this.servers.push(s);});
    return {...this.snapshot(),selectedId:s.id};
  }
  async editServer(id,value,confirmOriginChange=false) {
    let selectedId=id,clearId;
    await this.mutate(()=>{
      const old=this.server(id);const updated=this.validateServer({...value,id},true);
      if(this.servers.some(s=>s.id!==id&&s.url===updated.url))fail('目标地址已存在，请使用已有实例或恢复其归档');
      if(old.url!==updated.url){
        if(!confirmOriginChange)fail('修改服务器地址需确认：旧实例将归档，新实例不继承旧凭据');
        if(updated.ca&&!value.confirmNewCa)fail('新地址的自定义 CA 需重新输入确认');
        old.archivedAt=new Date().toISOString();clearId=id;updated.id=crypto.randomUUID();selectedId=updated.id;this.servers.push(updated);
      }else{Object.assign(old,updated);}
    });
    if(clearId)this.tokens.delete(clearId);
    return {...this.snapshot(),selectedId};
  }
  async archiveServer(id,approved=false) {
    if(!approved)fail('删除实例需确认本地归档范围');
    await this.mutate(()=>{this.server(id).archivedAt=new Date().toISOString();});
    this.tokens.delete(id);return this.snapshot();
  }
  async restoreServer(id) {
    await this.mutate(()=>{const s=this.servers.find(x=>x.id===id&&x.archivedAt);if(!s)fail('归档实例不存在');if(this.servers.some(x=>x.id!==id&&!x.archivedAt&&x.url===s.url))fail('该地址已有活动实例');delete s.archivedAt;});
    return {...this.snapshot(),selectedId:id};
  }
  setToken(id,token) { this.server(id); this.tokens.set(id,str(token,'Rancher Token',65536)); return this.snapshot(); }
  clearToken(id) { this.tokens.delete(id); return this.snapshot(); }
  server(id) { const s=this.servers.find(s=>s.id===id&&!s.archivedAt); if(!s) fail('实例不存在或已归档'); return s; }
  async cacheAvailable(record) {
    try {const file=this.configPath(record.key);const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())return false;sanitizeKubeconfig(await fs.readFile(file,'utf8'));return true;}catch{return false;}
  }
  async sync(id,approved,refresh=false,clusterIds=[]) {
    if(!approved) fail('请先确认将请求并保存集群访问凭据');
    if(this.busy||this.mutating) fail('已有任务正在运行');
    if(!this.active) fail('扩展已停用');
    const server=this.server(id), token=this.tokens.get(id); if(!token) fail('请先输入此服务器的 Token（仅本次会话有效）');
    if(!Array.isArray(clusterIds)||clusterIds.length>1000||clusterIds.some(cid=>typeof cid!=='string'||!this.records.some(r=>r.serverId===id&&r.clusterId===cid)))fail('所选集群无效');
    const selected=new Set(clusterIds);
    this.busy=true; this.controller=new AbortController(); const signal=this.controller.signal; this.summary=null;this.message='正在读取集群列表…';
    let failures=0,updated=0,reused=0; const errors=[];
    try {
      // Finish all pagination before touching stale flags. Discovery failure preserves last state.
      const clusters=await discover(server,token,signal,this.transport);
      if(!this.active || signal.aborted) fail('同步已取消');
      const ids=new Set(clusters.map(c=>c.id));
      for(const r of this.records.filter(r=>r.serverId===id)) r.stale=!ids.has(r.clusterId);
      for(const c of clusters) {
        if(!this.active || signal.aborted) fail('同步已取消');
        if(selected.size&&!selected.has(c.id))continue;
        const key=clusterKey(id,c.id), existing=this.records.find(r=>r.key===key);
        if(existing)existing.available=await this.cacheAvailable(existing);
        if(existing && existing.available!==false && !refresh) { existing.name=c.name; existing.stale=false; existing.state=c.state; reused++; continue; }
        try {
          const config=await generate(server,c,token,signal,this.transport);
          if(!this.active || signal.aborted) fail('同步已取消');
          const previousRecord=existing ? {...existing} : null;
          let previousText;
          if(existing && existing.available!==false) previousText=await fs.readFile(this.configPath(key),'utf8');
          await atomicWrite(this.configPath(key),config.text);
          const record={key,serverId:id,clusterId:c.id,name:c.name,state:c.state,contexts:config.contexts,stale:false,available:true,updatedAt:new Date().toISOString()};
          if(existing) Object.assign(existing,record); else this.records.push(record);
          try {await this.save();} catch(error) {
            if(existing) Object.assign(existing,previousRecord); else this.records=this.records.filter(r=>r.key!==key);
            try {
              if(previousText!==undefined) await atomicWrite(this.configPath(key),previousText);
              else await fs.unlink(this.configPath(key));
            } catch {const fatal=new SafeError('索引保存失败且回滚失败，请检查磁盘与权限，停止后续同步');fatal.fatal=true;throw fatal;}
            throw error;
          }
          updated++;
          if(this.active) this.emit();
        } catch(e) { if(signal.aborted || !this.active || e.fatal) throw e; failures++; errors.push(`${c.name}: ${e instanceof SafeError ? e.message : '保存/生成失败（详细错误不回传，避免泄露凭据）'}`); }
      }
      await this.save();
      if(this.active) this.emit();
      this.summary={discovered:clusters.length,updated,reused,failed:failures,finishedAt:new Date().toISOString()};
      this.message=`发现 ${clusters.length} 个集群；新增/刷新 ${updated}，复用 ${reused}，失败 ${failures}。${errors.length ? '\n'+errors.join('\n') : ''}`;
    } finally {this.busy=false;this.controller=null;}
    return this.snapshot();
  }
  cancel() {this.controller?.abort(); return this.snapshot();}
  deactivate() {this.active=false;this.controller?.abort();this.tokens.clear();}
}
module.exports={Service,atomicWrite};
