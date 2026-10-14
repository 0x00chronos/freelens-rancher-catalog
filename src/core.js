'use strict';
const https = require('node:https');
const crypto = require('node:crypto');
const tls = require('node:tls');
const YAML = require('yaml');
class SafeError extends Error {}
const fail = (message) => { throw new SafeError(message); };
const obj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
function str(x, label, max = 4096) {
  if (typeof x !== 'string' || !x.trim() || x.length > max || /[\x00-\x1f]/.test(x)) fail(`${label} 无效`);
  return x;
}
function serverUrl(value) {
  let u; try { u = new URL(str(value, 'Rancher URL')); } catch { fail('Rancher URL 无效'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || !['', '/'].includes(u.pathname)) fail('Rancher URL 必须是无路径、用户名及查询参数的 HTTPS 根地址');
  return u.origin;
}
function safeUrl(value, base) {
  let u; try { u = new URL(value, `${base}/`); } catch { fail('Rancher API 链接无效'); }
  if (u.origin !== base || u.username || u.password || u.hash || !u.pathname.startsWith('/v3/')) fail('拒绝跨站或非 v3 API 链接');
  return u;
}
function requestJson({url, method = 'GET', token, ca, signal, timeoutMs = 30000}) {
  return new Promise((resolve, reject) => {
    let done = false; const finish = (err, value) => { if (done) return; done = true; clearTimeout(timer); err ? reject(err) : resolve(value); };
    const req = https.request(url, {method, signal, rejectUnauthorized: true, ca: ca ? [...tls.rootCertificates, ca] : undefined, headers: {Authorization: `Bearer ${token}`, Accept: 'application/json', ...(method === 'POST' ? {'Content-Type':'application/json'} : {})}}, (res) => {
      const chunks = []; let size = 0;
      res.on('data', (chunk) => { size += chunk.length; if (size > 8 * 1024 * 1024) { finish(new SafeError('Rancher 响应超过 8 MiB')); req.destroy(); } else chunks.push(chunk); });
      res.on('error', () => finish(new SafeError('Rancher 响应中断')));
      res.on('end', () => {
        if (res.statusCode >= 300 && res.statusCode < 400) return finish(new SafeError('拒绝 HTTP 重定向；请填写最终 HTTPS 地址'));
        if (res.statusCode < 200 || res.statusCode >= 300) return finish(new SafeError(`Rancher HTTP ${res.statusCode}；请检查权限、Token 与服务器地址`));
        try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { finish(new SafeError('Rancher 未返回有效 JSON')); }
      });
    });
    const timer = setTimeout(() => { finish(new SafeError('Rancher 请求超时')); req.destroy(); }, timeoutMs);
    req.on('error', (e) => finish(new SafeError(e.name === 'AbortError' ? '同步已取消' : 'Rancher 连接失败；请检查网络及 TLS/CA 证书')));
    req.end(method === 'POST' ? '{}' : undefined);
  });
}
async function discover(server, token, signal, transport = requestJson) {
  const base = serverUrl(server.url); let next = new URL('/v3/clusters?limit=100', base).href;
  const visited = new Set(), found = new Map();
  while (next) {
    if (visited.size >= 1000 || visited.has(next)) fail('分页循环或页数超过安全限制');
    const u = safeUrl(next, base); visited.add(next);
    const page = await transport({url: u, token, ca: server.ca, signal});
    if (!obj(page) || !Array.isArray(page.data)) fail('集群列表结构无效');
    for (const cluster of page.data) {
      if (!obj(cluster)) fail('集群记录结构无效');
      const id = str(cluster.id, '集群 ID', 253);
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) fail('集群 ID 格式无效');
      if (found.has(id)) fail('分页包含重复集群 ID');
      found.set(id, {id, name: typeof cluster.name === 'string' ? str(cluster.name, '集群名称', 512) : id, state: typeof cluster.state === 'string' ? cluster.state : 'unknown'});
      if (found.size > 10000) fail('集群数量超过安全限制');
    }
    const n = page.pagination?.next;
    if (n !== undefined && n !== null && typeof n !== 'string') fail('分页链接结构无效');
    next = n ? safeUrl(n, base).href : null;
  }
  return [...found.values()];
}
function keys(value, allowed, label) {
  if (!obj(value) || Object.keys(value).some((k) => !allowed.includes(k))) fail(`${label} 包含不支持/不安全的字段`);
}
function embedded(value, label) {
  str(value, label, 1024 * 1024);
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(value)) fail(`${label} 必须是 Base64 内嵌数据`);
  return value;
}
function sanitizeKubeconfig(raw) {
  if (typeof raw !== 'string' || raw.length > 4 * 1024 * 1024) fail('kubeconfig 大小无效');
  let input; try { input = YAML.parse(raw, {maxAliasCount: 0, uniqueKeys: true}); } catch { fail('kubeconfig YAML 无效或含别名'); }
  keys(input, ['apiVersion','kind','clusters','contexts','users','current-context','preferences'], 'kubeconfig');
  if (input.apiVersion !== 'v1' || input.kind !== 'Config') fail('kubeconfig 必须是 v1 Config');
  if (input.preferences !== undefined) keys(input.preferences, [], 'preferences');
  for (const field of ['clusters','users','contexts']) if (!Array.isArray(input[field]) || !input[field].length || input[field].length > 1000) fail(`kubeconfig ${field} 无效`);
  const names = (list) => { const n = list.map(x => str(x.name, '配置名称', 512)); if (new Set(n).size !== n.length) fail('kubeconfig 名称重复'); return new Set(n); };
  const clusters = input.clusters.map(x => {
    keys(x, ['name','cluster'], 'cluster'); keys(x.cluster, ['server','certificate-authority-data','insecure-skip-tls-verify','tls-server-name'], 'cluster 配置');
    const c = x.cluster; let url; try { url = new URL(c.server); } catch { fail('Kubernetes server 地址无效'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || c['insecure-skip-tls-verify'] === true) fail('仅允许启用证书验证的 HTTPS Kubernetes server');
    if (c['insecure-skip-tls-verify'] !== undefined && c['insecure-skip-tls-verify'] !== false) fail('TLS 验证字段无效');
    const cluster = {server: url.href};
    if (c['certificate-authority-data']) cluster['certificate-authority-data'] = embedded(c['certificate-authority-data'], 'CA');
    if (c['tls-server-name']) cluster['tls-server-name'] = str(c['tls-server-name'], 'TLS server name');
    return {name: x.name, cluster};
  });
  const users = input.users.map(x => {
    keys(x, ['name','user'], 'user'); keys(x.user, ['token','client-certificate-data','client-key-data'], '认证（exec、auth-provider 及本地文件引用被拒绝）');
    const user = {}; if (x.user.token) user.token = str(x.user.token, '集群 Token', 65536);
    if (x.user['client-certificate-data'] || x.user['client-key-data']) {
      user['client-certificate-data'] = embedded(x.user['client-certificate-data'], '客户端证书');
      user['client-key-data'] = embedded(x.user['client-key-data'], '客户端私钥');
    }
    if (!Object.keys(user).length) fail('kubeconfig 缺少静态认证信息');
    return {name: x.name, user};
  });
  const cn = names(clusters), un = names(users);
  const contexts = input.contexts.map(x => {
    keys(x, ['name','context'], 'context'); keys(x.context, ['cluster','user','namespace'], 'context 配置');
    if (!cn.has(x.context.cluster) || !un.has(x.context.user)) fail('context 引用了不存在的 cluster/user');
    const context = {cluster: x.context.cluster, user: x.context.user};
    if (x.context.namespace) context.namespace = str(x.context.namespace, 'namespace', 253);
    return {name:x.name, context};
  });
  const contextsNames = names(contexts); const current = str(input['current-context'], 'current-context', 512);
  if (!contextsNames.has(current)) fail('current-context 不存在');
  return {text: YAML.stringify({apiVersion:'v1',kind:'Config',clusters,users,contexts,'current-context':current}), contexts: contexts.map(x=>x.name)};
}
function clusterKey(serverId, clusterId) { return crypto.createHash('sha256').update(JSON.stringify([serverId, clusterId])).digest('hex'); }
async function generate(server, cluster, token, signal, transport = requestJson) {
  const url = new URL(`/v3/clusters/${encodeURIComponent(cluster.id)}?action=generateKubeconfig`, serverUrl(server.url));
  const result = await transport({url, method:'POST',token,ca:server.ca,signal});
  if (!obj(result) || typeof result.config !== 'string') fail('generateKubeconfig 未返回 config 字符串');
  return sanitizeKubeconfig(result.config);
}
module.exports = {SafeError, fail, obj, str, serverUrl, safeUrl, requestJson, discover, sanitizeKubeconfig, clusterKey, generate};
