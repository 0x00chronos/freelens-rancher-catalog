# Rancher Catalog for Freelens

Manage Rancher instances and connect their Kubernetes clusters from Freelens.

**Version 2.0.1 · FreeLens 2.x（API 基线 2.1.0） · Rancher Norman v3**

## 功能

- 原生偏好设置与独立 Rancher Catalog 页面，支持浅色和深色主题。
- 添加、编辑、删除归档及恢复多个 Rancher 实例。
- 同步集群列表，默认复用已保存的 kubeconfig 和集群 Token。
- 仅为新集群或缺失/损坏的本地配置请求凭据；支持逐集群手动刷新。
- 通过原生 Kubeconfig Syncs 导入集群，使用 FreeLens 的正常连接流程。
- 已同步集群支持编辑本地显示名称，重新同步保留自定义名称。
- API Token 仅在会话内存中保存；HTTPS 校验、自定义 CA、私有文件权限。

## 安装与升级

1. 在 FreeLens 2.x 的 **Extensions** 中安装本地 `freelens-rancher-catalog-2.0.1.tgz`，不要安装源码 ZIP。若仍使用 FreeLens 1.x，请保留插件 1.0.0。
2. 确认扩展已启用，并完整退出再启动 FreeLens。
3. 打开 **Preferences → Extensions → Rancher Catalog**，或从欢迎页打开 Rancher Catalog。
4. 展开“首次设置：将同步目录添加到 FreeLens”。复制插件显示的 `native-kubeconfigs` 路径，到 **Preferences → Kubernetes → Kubeconfig Syncs** 添加这个文件夹。只需添加一次；不要选择存放归档的上级目录，也不要同时导入同一批配置的副本。
5. 如已有缓存，FreeLens 可直接发现已缓存的可用配置。新实例或需要重新同步时，输入 Rancher URL 和会话 API Token，阅读说明后确认同步。
6. 导入完成后可以从 FreeLens 原生 Catalog 打开，或在插件中点击“连接”。

升级前保留旧插件的 `rancher-catalog-v1` 数据目录，包含 `state.json` 和 `*.yaml`。FreeLens 2 不会自动安装旧扩展。如果新插件没读到旧数据，分别在旧版和新版的“存储与安全”确认目录，退出 FreeLens 后，将备份恢复到新版显示的目录（先备份目标，勿覆盖新版已同步数据）。旧版 API Token 仅在内存，不会迁移；已有有效 kubeconfig 不必重新生成。不要把这些文件提交到仓库或上传给他人。

## 实例管理与凭据复用

### FreeLens 原生集群设置

在已同步集群的对应上下文旁点击「集群设置」，打开 FreeLens 自带的 Settings 页面（General、Proxy、Terminal、Namespace、Metrics、Node Shell and Debug 等）。入口与原生 Catalog 的 Settings 使用相同路由。需先完成 Kubeconfig Syncs 导入；无需先连接集群或输入 Rancher Token。设置由 FreeLens 原生界面处理，插件不提供 YAML 编辑器，也不会因打开设置而改写 kubeconfig 或更换凭据。

### 修改插件显示名

在集群目录点击“修改插件显示名”，可以给当前 Rancher 集群设置本地显示名称；留空恢复 Rancher 原名。别名保存在插件索引，同步或重启后仍然有效。它只影响插件页面，不改变 FreeLens 原生 Catalog 的上下文名称、集群 ID、配置内容或凭据。原生集群身份取决于导入文件路径和上下文；请勿移动目录或者手动重命名文件。

### 编辑 Rancher 实例

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
- kubeconfig 包含实际访问凭据，缓存和原生导入副本均保存在专属插件目录，不修改 `~/.kube/config`。POSIX 目录为 0700、文件为 0600；Windows 请额外检查 ACL。
- 使用最小权限账号。不要在 Issue、截图、日志或聊天中提交 Token 或 kubeconfig。
- 仅 HTTPS，始终验证证书；支持 PEM CA，不提供跳过 TLS 校验选项。
- 不跟随重定向；分页限制在相同 HTTPS origin 的 `/v3/` 下。
- 校验 kubeconfig 后原子写入；拒绝 `exec`、`auth-provider`、本地凭据文件引用、代理 URL、跳过 TLS、未知字段、重复 YAML 键及 aliases。
- 同步失败保留已有有效配置；禁用扩展取消在途任务并清除会话 Token。
- 插件无法防御已经控制本机或同权限扩展的恶意程序。
- FreeLens 原生监视设置独立于扩展。若停用或卸载扩展后还要移除已导入集群，请在 Kubeconfig Syncs 中移除该同步目录；仅停用扩展不会撤销凭据或移除监视设置。

## 兼容性与限制

目标为 FreeLens 2.x（以 2.1.0 扩展 API 为基线）、Rancher 2.9.1 legacy Norman v3 API。
不支持 Rancher URL 子路径、HTTP、SSO 浏览器登录、HTTP 代理/PAC 或基于 `exec` 的 Rancher CLI 认证。
若管理员设置 `kubeconfig-generate-token=false`，生成的 CLI 配置可能被安全校验拒绝；请与管理员确认兼容方案，不应为本插件盲目降低安全策略。

自动化覆盖模拟宿主交互，不等同于 FreeLens 桌面应用和 Rancher 实机验收。建议先在测试环境验证原生导入和连接。

## 开发

需要 Node.js 22+。

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
npm pack
node scripts/test-package.js freelens-rancher-catalog-2.0.1.tgz
```

运行时 YAML 依赖已打包。React、MobX 及扩展接口使用 Freelens 宿主提供的对象。
测试覆盖 URL/凭据边界、缓存复用、集群别名、实例归档恢复、并发和取消、React/jsdom 交互及打包入口验证。测试不连接实际 Rancher。

## 官方参考

- [FreeLens 2.1.0 扩展迁移指南](https://github.com/freelensapp/freelens/blob/v2.1.0/docs/extensions/migrating-from-v1.md)
- [Rancher 2.9.1 kubeconfig action](https://github.com/rancher/rancher/blob/v2.9.1/pkg/api/norman/customization/cluster/actions_kubeconfig.go)
- [Rancher API Token 说明](https://ranchermanager.docs.rancher.com/api/api-tokens)

MIT License。第三方许可证见 `THIRD_PARTY_NOTICES.txt`。
