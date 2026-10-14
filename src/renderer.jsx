'use strict';
const React=global.React;
const {Renderer}=global.LensExtensions;
const {useState,useEffect}=React;
const {Input}=Renderer.Component;
class RancherRendererIpc extends Renderer.Ipc {}
let ipc;
async function request(action,payload){
  if(!ipc)throw new Error('插件通信未初始化。请确认扩展已启用，并完整重启 Freelens。');
  const result=await ipc.invoke('request',action,payload);
  if(!result.ok)throw new Error(result.error);
  return result.data;
}
const styles={
 input:{width:'100%',margin:'5px 0 12px'},
 select:{width:'100%',minWidth:160,padding:'7px 9px',background:'var(--mainBackground)',color:'var(--textColorPrimary)',border:'1px solid var(--borderColor)',borderRadius:4},
 button:{width:'auto',minWidth:0,flex:'0 0 auto',display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'6px 12px',margin:0,cursor:'pointer',borderRadius:4,border:'1px solid var(--borderColor)',background:'var(--secondaryBackground)',color:'var(--textColorPrimary)',fontSize:'inherit',lineHeight:'1.4'},
 toolbar:{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8},
 section:{padding:'16px 0',borderBottom:'1px solid var(--borderColor)'},
 hint:{fontSize:12,opacity:.75,lineHeight:1.6,margin:'8px 0'},
 notice:{padding:12,margin:'12px 0',background:'var(--secondaryBackground)',border:'1px solid var(--borderColor)',borderRadius:4},
 label:{display:'block',fontWeight:500},
};
function Button({children,style,...props}){return <button type="button" style={{...styles.button,...style}} {...props}>{children}</button>;}
function RancherPanel({preferences=false}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[retry,setRetry]=useState(0);
 const [selected,setSelected]=useState(''),[token,setToken]=useState(''),[approved,setApproved]=useState(false),[filter,setFilter]=useState('');
 const [editor,setEditor]=useState(null),[name,setName]=useState(''),[url,setUrl]=useState(''),[ca,setCa]=useState(''),[newCa,setNewCa]=useState(false),[originApproved,setOriginApproved]=useState(false);
 const [deleteId,setDeleteId]=useState(''),[refreshId,setRefreshId]=useState(''),[refreshApproved,setRefreshApproved]=useState(false);
 useEffect(()=>{let alive=true,timer;setError('');const load=()=>request('status').then(x=>{if(alive)setData(x);}).catch(e=>{clearInterval(timer);if(alive)setError(e.message);});timer=setInterval(load,2000);load();return()=>{alive=false;clearInterval(timer);};},[retry]);
 async function run(action,payload){setError('');setPending(true);try{const next=await request(action,payload);setData(next);if(next.selectedId){setSelected(next.selectedId);setToken('');setApproved(false);setRefreshId('');setRefreshApproved(false);}return next;}catch(e){setError(e.message);}finally{setPending(false);}}
 const id=data?.servers.some(s=>s.id===selected)?selected:data?.servers[0]?.id||'';
 const server=data?.servers.find(s=>s.id===id);const busy=pending||data?.busy;
 const currentRecords=data?.records.filter(r=>r.serverId===id)||[];
 const editServer=editor==='edit'?server:null;
 let originChanged=false;try{originChanged=!!editServer&&new URL(url).origin!==new URL(editServer.url).origin;}catch{originChanged=!!editServer&&url!==editServer.url;}
 const showEditor=!!editor||!!data&&!data.servers.length;
 function beginEditor(mode){setEditor(mode);setName(mode==='edit'?server.name:'');setUrl(mode==='edit'?server.url:'');setCa(mode==='edit'?server.ca:'');setNewCa(false);setOriginApproved(false);setDeleteId('');setError('');}
 function selectServer(value){setSelected(value);setToken('');setApproved(false);setRefreshId('');setEditor(null);setDeleteId('');setError('');}
 function openCluster(record,context){const entity=[...Renderer.Catalog.catalogEntities.entities.values()].find(e=>e.metadata.source==='Rancher'&&e.spec?.kubeconfigPath===record.kubeconfigPath&&e.spec?.kubeconfigContext===context);if(!entity){setError('Catalog 尚未完成更新，请稍后重试。');return;}Renderer.Navigation.navigate(`/cluster/${encodeURIComponent(entity.getId())}`);}
 return <div data-testid="rancher-panel" style={{padding:preferences?0:24,width:'100%',maxWidth:1120,margin:preferences?0:'0 auto',boxSizing:'border-box',color:'var(--textColorPrimary)'}}>
  {!preferences&&<h1 style={{fontSize:24,margin:'0 0 8px'}}>Rancher Catalog</h1>}
  <p style={styles.hint}>统一管理 Rancher 集群连接。同步默认复用本地 kubeconfig，不轮换现有凭据。</p>
  {error&&<div role="alert" style={{...styles.notice,color:'var(--colorError)',borderColor:'var(--colorError)'}}>{error}<div style={{marginTop:8}}><Button onClick={()=>setRetry(n=>n+1)}>重试加载</Button></div></div>}
  {!data?<p role="status">{error?'配置加载失败。升级后请完整重启 Freelens，再重试加载。':'正在加载…'}</p>:<>
   <section style={styles.section} aria-label="Rancher 实例">
    <div style={{...styles.toolbar,justifyContent:'space-between',marginBottom:12}}><strong>Rancher 实例</strong><Button disabled={busy} onClick={()=>beginEditor('add')}>添加实例</Button></div>
    {!!data.servers.length&&<div style={styles.toolbar}><select aria-label="当前 Rancher" style={{...styles.select,flex:'1 1 300px',width:'auto'}} value={id} disabled={busy} onChange={e=>selectServer(e.target.value)}>{data.servers.map(s=><option key={s.id} value={s.id}>{s.name} · {s.url}</option>)}</select><Button disabled={busy} onClick={()=>beginEditor('edit')}>编辑</Button><Button disabled={busy} onClick={()=>{setDeleteId(id);setEditor(null);}}>删除实例</Button></div>}
    {showEditor&&<form style={styles.notice} onSubmit={async e=>{e.preventDefault();const result=await run(editor==='edit'?'edit':'add',{id,name,url,ca,confirmOriginChange:originApproved,confirmNewCa:newCa});if(result){setEditor(null);setName('');setUrl('');setCa('');setToken('');setApproved(false);}}}>
      <strong>{editor==='edit'?'编辑实例':'添加实例'}</strong>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:'0 16px',marginTop:12}}>
       <label style={styles.label}>实例名称<Input required maxLength={100} style={styles.input} value={name} onChange={setName} placeholder="例如：生产 Rancher" /></label>
       <label style={styles.label}>服务地址<Input required type="url" style={styles.input} value={url} onChange={value=>{setUrl(value);setOriginApproved(false);if(editor==='edit'&&value!==server.url){setCa('');setNewCa(false);}}} placeholder="https://rancher.example.com" /></label>
      </div>
      <details><summary>自定义 CA（可选）</summary><Input multiLine rows={3} style={styles.input} value={ca} onChange={value=>{setCa(value);setNewCa(true);}} placeholder="-----BEGIN CERTIFICATE-----" /><p style={styles.hint}>PEM 格式；始终校验 TLS 证书。</p></details>
      {originChanged&&<label style={{...styles.notice,display:'block'}}><input type="checkbox" checked={originApproved} onChange={e=>setOriginApproved(e.target.checked)} /> 确认地址变更：{editServer.url} 将归档；新地址创建独立实例，不继承 API Token、CA 或集群配置。新地址的 CA 如有需要，请重新输入。</label>}
      <div style={{...styles.toolbar,marginTop:12}}><Button type="submit" disabled={busy||(originChanged&&!originApproved)}>保存实例</Button>{!!data.servers.length&&<Button disabled={busy} onClick={()=>setEditor(null)}>取消</Button>}</div>
    </form>}
    {deleteId&&<div role="dialog" aria-label="删除实例确认" style={styles.notice}><strong>删除“{data.servers.find(s=>s.id===deleteId)?.name}”？</strong><p style={styles.hint}>仅从本插件和 Catalog 移除，并清除会话 Token。实例与 kubeconfig 保留在本地归档，可恢复；不删除远端集群、不撤销凭据。</p><div style={styles.toolbar}><Button disabled={busy} onClick={async()=>{const result=await run('archive',{id:deleteId,approved:true});if(result){setDeleteId('');setSelected('');setToken('');setApproved(false);setRefreshId('');setRefreshApproved(false);}}}>确认归档</Button><Button disabled={busy} onClick={()=>setDeleteId('')}>取消</Button></div></div>}
   </section>
   {server&&<section aria-label="同步设置" style={styles.section}>
    <div style={{...styles.toolbar,justifyContent:'space-between'}}><strong>认证与同步</strong><span style={styles.hint}>{server.hasToken?'API Token 已设置 · 仅本次会话':'未设置 API Token'}</span></div>
    <div style={{...styles.toolbar,alignItems:'center'}}><div style={{flex:'1 1 320px'}}><Input aria-label="Rancher API Token" type="password" autoComplete="off" spellCheck={false} style={{...styles.input,marginBottom:0}} value={token} onChange={setToken} placeholder={server.hasToken?'输入 Token 以替换当前会话凭据':'token-xxxxx:secret'} /></div><Button disabled={busy||!token} onClick={async()=>{const secret=token;setToken('');await run('token',{id,token:secret});}}>设置 Token</Button><Button disabled={busy||!server.hasToken} onClick={()=>run('clear-token',{id})}>清除 Token</Button></div>
    <label style={{display:'block',fontSize:12,lineHeight:1.6,margin:'14px 0'}}><input type="checkbox" checked={approved} disabled={busy} onChange={e=>setApproved(e.target.checked)} /> 允许向 {server.url} 请求缺失的访问凭据并保存在本机。Rancher 可能创建新 Token。</label>
    <div style={styles.toolbar}><Button disabled={busy||!approved||!server.hasToken} onClick={()=>{setApproved(false);run('sync',{id,approved:true});}}>同步集群</Button>{data.busy&&<Button onClick={()=>run('cancel')}>取消同步</Button>}<span role="status" style={styles.hint}>{busy?'处理中…':`${currentRecords.length} 个集群 · 默认复用已有凭据`}</span></div>
    {data.message&&<details style={{marginTop:10}} open={data.summary?.failed>0}><summary style={{fontSize:12}}>{data.summary?`同步结果：更新 ${data.summary.updated} · 复用 ${data.summary.reused} · 失败 ${data.summary.failed}`:'操作结果'}</summary><p role="status" style={{...styles.hint,whiteSpace:'pre-wrap'}}>{data.message}</p></details>}
   </section>}
   <section style={styles.section} aria-label="集群目录"><div style={{...styles.toolbar,justifyContent:'space-between'}}><strong>集群目录 · {currentRecords.length}</strong><span style={styles.hint}>当前实例</span></div><Input style={styles.input} aria-label="筛选集群" placeholder="搜索集群名称或 ID" value={filter} onChange={setFilter} />
    {!currentRecords.length&&<p style={styles.hint}>暂无集群。添加实例并同步后，可在此连接。</p>}
    {currentRecords.filter(r=>`${r.name} ${r.clusterId}`.toLowerCase().includes(filter.toLowerCase())).map(r=><article key={r.key} style={{padding:'12px 0',borderBottom:'1px solid var(--borderColor)'}}>
      <div style={{...styles.toolbar,justifyContent:'space-between'}}><div><strong>{r.name}</strong><span style={{...styles.hint,marginLeft:10}}>{r.clusterId}</span></div><Button disabled={busy||!server?.hasToken} onClick={()=>{setRefreshId(r.clusterId);setRefreshApproved(false);}}>刷新凭据</Button></div>
      <p style={{...styles.hint,margin:'4px 0 8px'}}>状态：{r.state||'未知'} · 配置更新：{new Date(r.updatedAt).toLocaleString()}{r.stale?' · 本次发现未返回，保留已有配置':''}</p>
      {r.available===false&&<p role="alert" style={styles.hint}>本地配置缺失或校验失败。同步或刷新此集群以修复。</p>}
      <div style={styles.toolbar}>{r.contexts.map(c=><Button key={c} onClick={()=>openCluster(r,c)}>连接：{c}</Button>)}</div>
      {refreshId===r.clusterId&&<div role="dialog" aria-label="刷新凭据确认" style={styles.notice}><label><input type="checkbox" checked={refreshApproved} disabled={busy} onChange={e=>setRefreshApproved(e.target.checked)} /> 确认仅重新生成“{r.name}”的 kubeconfig。这可能新增 Token；不会撤销旧凭据。</label><div style={{...styles.toolbar,marginTop:10}}><Button disabled={busy||!refreshApproved} onClick={async()=>{setRefreshApproved(false);const result=await run('sync',{id,approved:true,refresh:true,clusterIds:[r.clusterId]});if(result)setRefreshId('');}}>确认刷新</Button><Button disabled={busy} onClick={()=>setRefreshId('')}>取消</Button></div></div>}
    </article>)}
   </section>
   {!!data.archives?.length&&<details style={styles.section}><summary>已归档实例 · {data.archives.length}</summary>{data.archives.map(s=><div key={s.id} style={{...styles.toolbar,justifyContent:'space-between',marginTop:12}}><div><strong>{s.name}</strong><div style={styles.hint}>{s.url} · {s.clusterCount} 个缓存集群</div></div><Button disabled={busy} onClick={()=>run('restore',{id:s.id})}>恢复实例</Button></div>)}</details>}
   <details style={{marginTop:16}}><summary style={styles.hint}>存储与安全</summary><p style={{...styles.hint,overflowWrap:'anywhere'}}>kubeconfig 含访问凭据，目录：{data.root}。请保护本地文件及备份；Windows 需检查目录 ACL。删除或卸载插件不撤销 Rancher 凭据。</p></details>
  </>}
 </div>;
}
// Host #lens-views has z-index:1. Keep global pages above it without nesting main.
function RancherPage(){return <div data-testid="rancher-route" style={{position:'relative',zIndex:2,flex:1,minHeight:0,width:'100%',overflowY:'auto',background:'var(--mainBackground)'}}><RancherPanel /></div>;}
function RancherPreferences(){return <RancherPanel preferences />;}
class RancherRendererExtension extends Renderer.LensExtension{
 constructor(...args){super(...args);this.globalPages=[{id:'rancher-catalog',components:{Page:RancherPage}}];this.welcomeMenus=[{title:'Rancher Catalog',icon:'cloud',click:()=>this.navigate('rancher-catalog')}];this.appPreferences=[{title:'Rancher Catalog',components:{Input:RancherPreferences,Hint:()=> <span/>}}];}
 onActivate(){ipc=RancherRendererIpc.createInstance(this);}
 onDeactivate(){ipc=undefined;}
}
module.exports={default:RancherRendererExtension};
