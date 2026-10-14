# Rancher Catalog for Freelens

Manage Rancher instances and connect their Kubernetes clusters from Freelens.

**Version 1.0.0 · Freelens 1.10.x (SDK 1.10.3) · Rancher 2.9.1**

## 功能

- 原生偏好设置与独立 Rancher Catalog 页面，支持浅色和深色主题。
- 添加、编辑、删除归档及恢复多个 Rancher 实例。
- 同步集群列表，默认复用已保存的 kubeconfig 和集群 Token。
- 仅为新集群或缺失/损坏的本地配置请求凭据；支持逐集群手动刷新。
- 使用原生 KubernetesCluster 实体，保留 Freelens 的集群连接功能。
- API Token 仅在会话内存中保存；HTTPS 校验、自定义 CA、私有文件权限。

## 安装与升级

1. 下载 GitHub Release 中的 `freelens-rancher-catalog-1.0.0.tgz`，或解压交付 ZIP 后取出该文件。
2. 在 Freelens **Extensions** 中安装本地 `.tgz`，不要安装源码 ZIP。
3. **完整退出并重新启动 Freelens**。只关闭窗口可能不会重新加载扩展。
4. 打开 **Preferences → Extensions → freelens-rancher-catalog**。
5. 添加实例名称及 HTTPS 根地址，例如 `https://rancher.example.com`。
6. 输入完整 Rancher API Token，点击“设置 Token”，阅读凭据说明后勾选确认并同步。
7. 在偏好设置或 **File → Rancher Catalog** 中选择集群连接。

从 0.1.x 升级保留原实例 ID、数据格式和目录。**不要删除原插件配置目录。**

## 实例管理与凭据复用

### 编辑

修改名称或同地址的 CA 不改变实例 ID、已保存的 kubeconfig 或集群 Token。
修改服务器地址需单独确认：旧实例归档，新地址创建独立实例，不继承旧 API Token 或集群配置。新 CA 必须重新输入。插件不会将旧凭据自动发送到新服务器。

### 删除与恢复

“删除实例”执行可恢复的本地归档：从活动列表和 Catalog 移除、清除会话 API Token，保留原实例 ID 和 kubeconfig。不会删除 Rancher 远端集群或撤销远端 Token。
在“已归档实例”中恢复可复用原配置。再次添加相同地址会提示恢复，避免重复生成凭据。归档不等于安全擦除，文件与备份仍需保护。

### 同步与刷新

普通同步更新名称和状态，并复用可安全读取的本地 kubeconfig。网络错误、401/403 或集群从列表消失都不会触发批量凭据轮换。
只在确有必要时对单个集群使用“刷新凭据”，显式确认后请求新的 kubeconfig。插件无法可靠推断所有静态 Token 的到期时间，也不会自动刷新或撤销旧 Token。

Rancher 2.9.1 的 `generateKubeconfig` **可能创建新的访问 Token**。其期限受管理员设置影响。默认同步尽量避免再次调用此接口，但本地配置缺失或校验失败时仍需生成替代配置。

## 安全说明

- Rancher API Token 仅保留在内存；重启后需重新输入，不写入索引、日志或源码。
- kubeconfig 包含实际访问凭据，保存在专属插件目录，不修改 `~/.kube/config`。POSIX 目录为 0700、文件为 0600；Windows 请额外检查 ACL。
- 使用最小权限账号。不要在 Issue、截图、日志或聊天中提交 Token 或 kubeconfig。
- 仅 HTTPS，始终验证证书；支持 PEM CA，不提供跳过 TLS 校验选项。
- 不跟随重定向；分页限制在相同 HTTPS origin 的 `/v3/` 下。
- 校验 kubeconfig 后原子写入；拒绝 `exec`、`auth-provider`、本地凭据文件引用、代理 URL、跳过 TLS、未知字段、重复 YAML 键及 aliases。
- 同步失败保留已有有效配置；禁用扩展取消在途任务并清除会话 Token。
- 插件无法防御已经控制本机或同权限扩展的恶意程序。

## 兼容性与限制

目标版本为 Freelens 1.10.x、Rancher 2.9.1 legacy Norman v3 API；Freelens 2.0 nightly 未验证。
不支持 Rancher URL 子路径、HTTP、SSO 浏览器登录、HTTP 代理/PAC 或基于 `exec` 的 Rancher CLI 认证。
若管理员设置 `kubeconfig-generate-token=false`，生成的 CLI 配置可能被安全校验拒绝；请与管理员确认兼容方案，不应为本插件盲目降低安全策略。

基础同步已获得使用者实机反馈。1.0.0 新增交互通过自动化回归，**不等同于所有系统的真实 Electron GUI 或 Rancher 实机验收**。建议先在测试环境升级。

## 开发

需要 Node.js 22+。

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
npm pack
node scripts/test-package.js freelens-rancher-catalog-1.0.0.tgz
```

运行时 YAML 依赖已打包。React、MobX 及扩展接口使用 Freelens 宿主提供的对象。
测试包括 URL/凭据边界、缓存复用、实例编辑归档恢复、并发与取消、React/jsdom 交互，以及发布版 SDK 实际 IPC 类的激活/清理/恢复回归。Electron 传输与网络由测试适配器隔离。

## 官方参考

- [Freelens 1.10.3](https://github.com/freelensapp/freelens/tree/v1.10.3)
- [Rancher 2.9.1 kubeconfig action](https://github.com/rancher/rancher/blob/v2.9.1/pkg/api/norman/customization/cluster/actions_kubeconfig.go)
- [Rancher API Token 说明](https://ranchermanager.docs.rancher.com/api/api-tokens)

MIT License。第三方许可证见 `THIRD_PARTY_NOTICES.txt`。
