---
title: Hash SLI/SLO pilot review
created: 2026-09-01
updated: 2026-09-26
status: archived
owners: [liuzel01]
sources: ["local OpenClaw workspace review, migrated to this repository"]
source_kind: credential-redacted-operational-source
redaction: "Applied only to passwords, tokens, private keys, authorization headers, and cloud access-key material."
reviewed_by: liuzel01
---
# Hash SLI/SLO Pilot 落地复盘（2026-09-01）

## TL;DR

Hash 测试环境的 Gateway App + Tenant SLI/SLO 试点，已完成从**指标边界定义 → Dashboard → recording rule → 观察告警草案与 Runbook**的基础闭环。

当前处于“**已具备观测与规则计算能力，尚未具备真实通知/生产级 SLO 承诺条件**”阶段。下一关键 Gate 是补齐 DRI、受控 Lark 路由、14 天基线和一次可回滚通知演练。

---

## 1. 复盘范围与结论

- **环境：**`hash` 测试环境
- **试点服务：**
  - Gateway App：`default/kylin-gateway-app`，入口 Service：`default/kylin-gateway-app-service`
  - Tenant Impl：`default/kylin-tenant-kylin-tenant-impl`
- **目标：**建立可验证的 SLI 指标、Dashboard、recording rule、低优先级观察告警候选和标准 Runbook；不将测试环境指标直接作为生产 SLA。

### 当前成熟度判断

| 能力层 | 状态 | 结论 |
|---|---|---|
| 指标采集与语义 | 已建立 | Gateway 使用 Ingress NGINX 指标；Tenant 使用 Spring/Micrometer 指标。 |
| SLI/Dashboard | 已建立 | Grafana `Hash / SLO Pilot`（UID：`hash-slo-pilot`）已创建，含 10 个面板。 |
| Recording Rule | 已上线 | `hash-sli-slo-pilot-rules` 已提供 7 条聚合计算序列。 |
| Alert Rule | 已形成草案 | 7 条 `warning` 级观察告警已写入独立文件；占位 Owner/链接及通知 Gate 尚未满足，未应 apply。 |
| 通知、演练、SLO 固化 | 未完成 | 需完成受控路由、14 天基线、低优先级演练和复盘后再推进。 |

---

## 2. 里程碑与已实现内容

### M1｜试点边界与 SLI 契约完成

**已实现**

- Gateway 以 `service="kylin-gateway-app-service"` 聚合全部入口流量，不以单一 Ingress/Host 误定义边界。
- Gateway 可用性定义：非 `5xx` 为成功，`5xx` 为失败；`4xx` 单独观察、不计入本次平台可用性失败。
- Tenant 锁定候选 URI 范围：`/tenant/admin/(channel/.*|coin/list|otc.*)`，并排除 `/actuator.*`。
- Tenant 采用相同的非 `5xx` 成功语义，但明确要求存在真实请求样本后才解释成功率。

**价值**

- 避免以单个路由、探针流量或无流量窗口得出错误的服务可用性结论。
- 为后续按用户旅程细分正式生产 SLO 保留了演进空间。

### M2｜Gateway 与 Tenant 指标模型完成

| 服务 | 已纳入指标 | 延迟能力 | 当前限制 |
|---|---|---|---|
| Gateway | 请求速率、5xx、成功率、4xx、P95 ingress 延迟 | 支持 P95 | P95 仅用于 14 天基线观察，尚未固化为生产阈值。 |
| Tenant | 候选 URI 请求速率、5xx、成功率、平均延迟、24h 样本量 | 仅平均延迟 | 当前无 `http_server_requests_seconds_bucket`，不能可靠计算 P95/P99。 |

**Tenant P95/P99 结论**

- 不是 Dashboard 或 Rule 漏配，而是应用当前未暴露 histogram bucket。
- 后续由 Tenant 应用侧启用 Micrometer `http.server.requests` percentile histogram 与 SLA bucket；验证 `/actuator/prometheus` 出现 `http_server_requests_seconds_bucket` 后，才可新增 P95/P99 查询、记录规则或告警。

### M3｜可视化观测完成

**已实现 Dashboard：**`Hash / SLO Pilot`（UID：`hash-slo-pilot`）

- 已包含 10 个面板：Gateway G1–G5、Tenant T1–T5。
- Gateway 展示请求、5xx、成功率、4xx、P95。
- Tenant 展示请求、5xx、成功率、平均延迟、24h 请求样本量。
- Dashboard 创建后已通过 Grafana API 回读，并经关联 Prometheus datasource 验证各面板查询可返回数据（Runbook 记录：2026-08-31）。
- 所有颜色和初始阈值均是**测试环境观察用途**，不是生产告警承诺。

### M4｜Recording Rule 已上线

文件：`k8s-yaml/monitoring/prometheus-rules/hash-sli-slo-pilot-rules.yaml`

**已上线的 7 条记录规则：**

- Gateway：请求速率、5xx 速率、成功率、P95 延迟。
- Tenant：候选 URI 请求速率、5xx 速率、平均延迟。

**设计要点**

- 统一生成 `hash_sli_slo_pilot:*:rate5m` 序列，供 Dashboard、后续告警与演练复用。
- Tenant 成功率不单独记录：当前低流量下容易造成“无请求即 100%”的误读；其样本量由 Tenant 请求量规则和 Dashboard T5 共同约束。

### M5｜观察告警候选完成，尚未上线通知

文件：`k8s-yaml/monitoring/prometheus-rules/hash-sli-slo-pilot-alert-rules.yaml`

**已形成 7 条 `severity: warning` 观察告警草案：**

1. Gateway metrics target down
2. Gateway 5xx observed
3. Gateway success ratio low（<90%，且请求速率 ≥0.1 req/s）
4. Gateway P95 latency observed（>1.5s，且请求速率 ≥0.1 req/s）
5. Tenant metrics target down
6. Tenant 5xx observed（含最低流量保护）
7. Tenant mean latency observed（>1s，含最低流量保护）

**关键控制措施**

- 告警文件与 recording rule 独立，避免“计算逻辑”和“通知策略”混合发布。
- 均为 warning，`for` 为 5–10 分钟；未设计 Pager、burn-rate 或 CI/CD 阻断。
- Gateway / Tenant 业务类告警均保留最低流量保护，降低低样本误报。
- 草案仍含 `REPLACE_WITH_*` 的 Owner、Dashboard URL、Runbook URL 占位符；未配置 Lark Webhook。

---

## 3. 阶段 Gate 复盘

| 阶段 | 目标 | 状态 | 说明 |
|---|---|---|---|
| 0 | 范围、DRI、通知与业务旅程 | 部分完成 | 技术范围已明确；应用/平台 DRI、测试通知目的地仍需正式填充。 |
| 1 | 平台与业务采集基线 | 部分完成 | Tenant ServiceMonitor target 已确认可用；Gateway NGINX 入口链路可用。Gateway 应用 `/actuator/prometheus` 接入仍取决于研发镜像/endpoint Gate。 |
| 2 | Gateway Ingress 指标链路 | 已完成 | 使用独立 ClusterIP metrics Service/ServiceMonitor 的架构，避免将 `10254` 暴露到 NLB。 |
| 3 | SLI/SLO 与 Dashboard 基线 | 已完成基础能力 | Dashboard、查询与指标语义已建立；14 天数据基线尚未完成。 |
| 4 | Recording / Alert Rule 与路由 | 部分完成 | recording rule 已上线；alert rule 仅为草案，未 apply、未发送通知。 |
| 5 | 发布守门、韧性与演练 | 未完成 | 尚需一次 Gateway 可回滚演练及 Tenant 采集断链桌面演练。 |
| 6 | 容量与扩展决策 | 未开始 | 应在双试点完成 14 天闭环后再选择下一批 workload。 |

---

## 4. 关键设计决策（保留原因）

| 决策 | 原因 | 避免的问题 |
|---|---|---|
| Gateway 以 Service 聚合，而非单 Ingress | 同一 Gateway Service 对应多个入口/host | 监控覆盖不全、错误归因偏差。 |
| Tenant T1 请求量不直接告警 | 候选 URI 并非已确认必须持续有流量的关键旅程 | 低峰/后台无人操作时的无效告警。 |
| Tenant 不以 `max` 替代 P99 | `max` 对单个极端慢请求敏感，不表达分位延迟 | 延迟误判。 |
| Alert 先 warning、后升级 | 尚无 14 天基线、DRI 与路由演练 | 未验证规则直接形成噪音或夜间升级。 |
| 不把 NGINX metrics 端口加入 NLB | metrics 应仅在集群内由 Prometheus 抓取 | 对公网额外暴露 `10254`。 |

---

## 5. 未完成项与进入下一阶段的 Gate

### P0｜真实通知上线前必须完成

- [ ] 明确 Gateway/Tenant 应用 DRI 与 Platform/SRE DRI，替换告警 `owner` 占位符。
- [ ] 明确测试 Lark receiver，Webhook 仅保存在受控 Secret/密钥管理，不进入 Git 或 PrometheusRule。
- [ ] 确认 Alertmanager route 限制为测试/工作时段，并具备静默、禁用路由或删除规则的回滚路径。
- [ ] 填入可访问的 Dashboard / Runbook 链接。
- [ ] 在 Prometheus Explore 逐条以 live labels 预检 7 条表达式。
- [ ] 仅选择 1 条 warning 告警进行受控验证，核验 Pending → Firing → 路由 → 恢复通知全链路。

### P1｜SLO 固化前必须完成

- [ ] 连续采集至少 14 天 Gateway 请求、5xx、P95 基线。
- [ ] Tenant 确认真实业务 URI、调用方及最低合理样本量；T5 无有效样本时继续标记为“无有效样本”。
- [ ] 完成 Gateway 单 Pod 可回滚演练与 Tenant metrics 断链桌面演练。
- [ ] 基于基线复核 Gateway 99.5% / 30d 及 P95 1.5s 的合理性；评估 5xx 与成功率低告警的重叠，必要时演进为 burn-rate。

### P2｜Tenant 分位延迟能力

- [ ] 在 Tenant 应用配置层开启 `http.server.requests` histogram（优先应用配置/Helm values/ConfigMap；只有当前配置由环境变量注入时才改 Deployment env）。
- [ ] 配置合理 SLA buckets，滚动发布后验证 bucket 指标与 Prometheus time-series 基数。
- [ ] 在真实样本足够后再引入 Tenant P95/P99 Dashboard 与告警候选。

---

## 6. 风险与止损

| 风险 | 现有防护 | 止损动作 |
|---|---|---|
| 告警噪音或错误路由 | warning、最小流量保护、工作时段限制、独立 alert 文件 | 删除/回退对应 alert rule 或静默测试 receiver；保留样本用于 R-03 复盘。 |
| 无流量被误判为可用 | Tenant T5 样本量 Gate、T1 仅作为门槛 | 标记“无有效样本”，不解释成功率。 |
| NGINX metrics 暴露风险 | 使用独立 ClusterIP metrics Service | 若误暴露，确认内部采集正常后，仅移除 NLB Service 的 metrics port。 |
| 以测试阈值替代生产 SLA | Runbook 明确禁止 | 等业务旅程、Owner、基线与评审齐备后再生产化。 |
| Histogram 增加指标基数 | 仅建议先在 Tenant 开启 | 发布后观察 Prometheus time series 与资源消耗，异常则回退应用配置。 |

---

## 7. 建议的后续顺序

1. **先完成通知与演练 Gate：**补齐 DRI/路由/链接，选一条 warning 告警做工作时段受控验证。
2. **再完成 14 天基线复核：**将 Dashboard 数据沉淀为可解释的 Gateway 与 Tenant 基线记录。
3. **最后推进生产化能力：**评估 Gateway burn-rate；为 Tenant 启用 histogram 后再引入 P95/P99；双试点闭环后扩展至下一批服务。

---

## 8. 关联资产

- 执行 Runbook：`k8s-yaml/monitoring/alerting/hash-sli-slo-pilot-execution-runbook.md`
- Recording rules：`k8s-yaml/monitoring/prometheus-rules/hash-sli-slo-pilot-rules.yaml`
- Alert rules 草案：`k8s-yaml/monitoring/prometheus-rules/hash-sli-slo-pilot-alert-rules.yaml`
- Gateway NGINX ServiceMonitor：`k8s-yaml/monitoring/servicemonitor/ingress-nginx-controller-metrics-svcmonitor.yaml`
- Grafana Dashboard：`Hash / SLO Pilot`（UID：`hash-slo-pilot`）
