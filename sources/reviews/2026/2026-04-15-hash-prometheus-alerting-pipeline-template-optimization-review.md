---
title: Hash Prometheus alerting pipeline and template optimization review
created: 2026-04-15
updated: 2026-11-17
status: archived
owners: [liuzel01]
sources: ["local OpenClaw workspace review, migrated to this repository"]
source_kind: credential-redacted-operational-source
redaction: "Applied only to passwords, tokens, private keys, authorization headers, and cloud access-key material."
reviewed_by: liuzel01
---
# 2026-04-15 hash 集群 PrometheusAlert 告警链路与模板优化复盘

## 1. 背景与目标

在 `hash` EKS 集群中，用户希望：

1. 使用 `PrometheusRule` + Alertmanager + PrometheusAlert 发送 Lark 群通知；
2. 修复「告警有触发但群里不稳定收到」的问题；
3. 提升告警消息可读性（字段更全、减少空行、屏蔽链接可访问）；
4. 将线上改动同步到本地仓库，避免后续 `apply` 回退。

---

## 2. 关键现象与根因

### 2.1 告警触发但通知不稳定

- 现象：Prometheus 中 active/firing 告警存在，但群里并非持续可见。
- 核查发现：
  - 链路本身是通的（Alertmanager -> PrometheusAlert 有 `POST /prometheusalert 200`）；
  - 发送侧出现过两类错误：
    - `19001 incoming webhook access token invalid`
    - `9499 too many request`

**根因总结：**

- 历史配置混杂（旧 webhook/多通道并发）导致 token invalid 噪音；
- 告警风暴触发飞书限流；
- `repeat_interval` 实际生效值与预期不一致（曾是 12h 而非 3h）。

### 2.2 屏蔽链接不可访问

- 现象：通知中的“点我屏蔽该告警”跳到 `http://alertmanager-main-0:9093/...`（集群内地址）。
- 根因：模板使用 `.externalURL`，而 Alertmanager 对外 URL 未统一为公网域名。

### 2.3 模板显示问题

- 现象：
  - 字段缺失时出现大量空行；
  - `详情` 后出现 `---` 粘连文本（`...description.---`）。
- 根因：
  - 模板换行/空白裁剪策略与飞书 `lark_md` 渲染叠加；
  - `---` 在当前渲染路径下未按预期作为“分隔线组件”处理，而是普通文本。

---

## 3. 实施改动（线上）

## 3.1 PrometheusAlert 通道与配置收敛

在 `monitoring/prometheus-alert-center-conf`（app.conf）中完成：

- `open-feishu=1`（保留）
- `fsurl` 更新为新 webhook：
  - `<LARK_WEBHOOK_URL_REDACTED>`
- 关闭非必要通道：
  - `open-dingding=0`
  - `open-weixin=0`
  - `open-voice=0`
  - `open-kafka=0`
- `open-feishuapp=0`（避免 feishuapp 占位配置引发无效发送噪音）

并重启 `deployment/prometheus-alert-center` 生效。

## 3.2 Alertmanager 生效配置修正（hash 实际源）

关键发现：`Alertmanager/main` 实际使用的是：

- `spec.configSecret: <PROMETHEUS_ALERT_CONFIG_SECRET_NAME>`

因此后续以 `alertmanager-main-mvp` 为真实变更源，完成：

- 主路由节流参数：
  - `group_by: [alertname, namespace, severity]`
  - `group_wait: 60s`
  - `group_interval: 5m`
  - `repeat_interval: 3h`
- 主接收器 URL 切换到：
  - `tpl=prometheus-feishu-app`
  - 新 `fsurl`

并重建 `alertmanager-main` pods（3 副本）确认加载。

## 3.3 屏蔽链接公网可访问修复

双保险处理：

1. Alertmanager CR 增加对外 URL：
   - `spec.externalUrl: https://alertmanager.hashex.vip`
   - `spec.routePrefix: /`

2. 模板中屏蔽链接基地址固定公网：
   - `{{- $var := "https://alertmanager.hashex.vip" -}}`

---

## 4. 模板优化过程与最终结论

目标模板：`prometheus-feishu-app`

优化轨迹：

1. 从简版模板切换到增强字段版本（告警名、级别、namespace、workload、instance、summary、description 等）；
2. 修复空行过多（通过更紧凑的条件拼接）；
3. 修复“详情后 `---` 粘连”问题；
4. 最终去掉 `---` 作为分隔方式，改为空行分隔（在当前飞书渲染路径更稳定）。

> 结论：在当前 `prometheusalert -> feishuv2 -> lark_md` 渲染链路里，`---` 不稳定，建议不用文本分隔线，使用空行/字段块分隔。

---

## 5. 本地仓库同步（防回退）

仓库：`/Users/liuzelin/github/lemo-kube-prometheus`（分支：`hashex`）

已同步的关键文件：

1. `lemo/prometheusAlert-Deployment.yaml`
   - fsurl 更新
   - 关闭 dingding/weixin/voice/kafka
   - `open-feishuapp=0`

2. `lemo/alertmanager-main-mvp-secret.yaml`
   - hash 真实使用的 Alertmanager 配置源
   - 主 receiver URL 使用 `tpl=prometheus-feishu-app`
   - 路由参数（group/repeat）优化

3. `manifests/alertmanager-secret.yaml`
   - 同步 URL 与路由参数（作为通用清单侧一致性）

4. `manifests/alertmanager-alertmanager.yaml`
   - 新增：
     - `externalUrl: https://alertmanager.hashex.vip`
     - `routePrefix: /`

5. `lemo/templates/prometheus-feishu-app.tpl`
   - 将线上生效模板文件化，便于灾后恢复

6. `lemo/templates/README-prometheus-alert-template.md`
   - 提供模板回灌 sqlite 的标准命令

---

## 6. 验证记录（代表性）

多轮 smoke 请求均返回：

- HTTP `200`
- body: `{"code":0,"msg":"success"}`

覆盖告警名包括：

- `HashMVPWebhookSmokeTest`
- `KubePodNotReady`
- `KubeDeploymentReplicasMismatch`
- `KubeStatefulSetReplicasMismatch`
- `PrometheusKubernetesListWatchFailures`

验证维度：

- 链路可达（发送成功）
- 模板字段渲染
- 屏蔽链接可访问域名
- 空行与分隔表现

---

## 7. 最终状态（当前）

1. hash 告警主链路可用；
2. 模板已切换到 `prometheus-feishu-app`；
3. 屏蔽链接走公网 `https://alertmanager.hashex.vip`；
4. 本地仓库已同步关键 YAML + 模板文件，显著降低回退风险。

---

## 8. 任务完成度评估（针对“各环境 Lark 告警接入”）

目标任务描述：

> 接入 Lark 告警通知。在各环境 Grafana 配置 Contact Point（Webhook）与通知路由：Critical 直达值班群、Warning 聚合降噪，并开启恢复通知（Resolved）。

当前评估：

- **不可判定为“全量完成”**，目前仅能确认 `hash` 环境这套链路已打通并优化；
- `Resolved` 在当前链路中已开启（`send_resolved: true`）；
- “各环境 Grafana Contact Point 与路由策略”仍需逐环境验收并补齐。

建议状态：

- 任务状态应标记为：**进行中（hash 已完成，其他环境待推广）**。

---

## 9. 多环境推广策略（本次讨论结论）

### 9.1 分支与仓库策略

- 使用仓库：`~/github/lemo-kube-prometheus`
- `hash` 环境对应分支：`hashex`
- 其他环境：各建独立分支（环境隔离）

推荐方式：

- 以 `hash` 为金标基线持续优化；
- 将优化点按“基线 + 环境变量”方式同步到其他环境分支；
- 环境特有项（webhook、域名、群、阈值）参数化维护。

### 9.2 推广流程（建议）

1. 在 `hash` 分支固化模板与路由策略；
2. 复制到目标环境分支并替换环境参数；
3. 逐环境 apply；
4. 每环境执行 smoke 验收（firing/resolved/屏蔽链接）；
5. 验收通过后再推广下一环境。

### 9.3 防漂移要求

- 优先保证“线上真实生效源”与分支文件一致（特别是 `alertmanager-main-mvp` 类真实配置源）；
- 模板正文继续文件化 + 回灌命令保留，避免重建后回退；
- 定期执行“线上 vs 仓库”对比，发现漂移立即回写。

---

## 10. 后续建议

1. 规范化规则标签（`severity/team/service/owner`）以提升告警可读性和分流质量；
2. 为核心规则补 `runbook_url`，实现消息到处置闭环；
3. 对高频告警（如 PodNotReady/ReplicasMismatch）做更细分组与抑制，减少限流；
4. 如果后续使用 GitOps，建议把 `alertmanager-main-mvp` 作为唯一权威源，避免多份 secret 语义冲突；
5. 为“各环境 Grafana Contact Point/路由/Resolved”建立验收清单，按环境逐项打勾。

---

## 11. 备注

- 本次明确 **未对 mega 线上集群做写操作**（仅 hash）。
- `prometheus-feishu-app` 模板正文在 PrometheusAlert sqlite 中，需依赖模板文件回灌机制保障可恢复性。
