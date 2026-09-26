---
title: Review - Hash SLI/SLO pilot review
created: 2026-09-01
updated: 2026-09-01
status: draft
owners: [liuzel01]
sources: ["sources/reviews/2026/2026-09-01-hash-sli-slo-pilot-review.md"]
generated:
  tool: openclaw
  skill: review
  skill_version: null
  reviewed_by: null
---

# Review - Hash SLI/SLO pilot review

## 背景与范围

本次试点覆盖 `hash` 测试环境的 Gateway App 与 Tenant Impl，目标是建立可验证的 SLI、Dashboard、recording rule、观察告警候选和 Runbook，不将测试环境指标直接作为生产 SLA。

已完成指标边界、Dashboard、7 条 recording rules 及 7 条 `warning` 级观察告警草案。当前具备观测与规则计算能力，尚不具备真实通知或生产级 SLO 承诺条件。

## 结论

- Gateway 与 Tenant 的基础 SLI 语义和 Dashboard 已建立。
- Recording rules 已上线；告警仍为草案，尚未 apply 或发送通知。
- Tenant 当前未暴露 histogram bucket，不能可靠计算 P95/P99。
- Gateway P95 仅用于 14 天基线观察，尚未固化为生产阈值。
- 下一阶段应先补齐 DRI、受控 Lark 路由、链接、14 天基线及可回滚通知演练，再评估 SLO 固化和生产化。

## 证据与来源

- Grafana Dashboard：`Hash / SLO Pilot`，UID：`hash-slo-pilot`，包含 Gateway G1–G5、Tenant T1–T5 共 10 个面板。
- Recording rules：`k8s-yaml/monitoring/prometheus-rules/hash-sli-slo-pilot-rules.yaml`
- Alert rules 草案：`k8s-yaml/monitoring/prometheus-rules/hash-sli-slo-pilot-alert-rules.yaml`
- 执行 Runbook：`k8s-yaml/monitoring/alerting/hash-sli-slo-pilot-execution-runbook.md`
- Dashboard 已通过 Grafana API 回读，并经 Prometheus datasource 验证查询可返回数据；Runbook 记录日期为 2026-08-31。

## 风险与后续行动

### 必须先完成

- 明确 Gateway/Tenant 应用 DRI 与 Platform/SRE DRI，替换 `owner` 占位符。
- 配置受控测试 Lark receiver，并确保 Webhook 不进入 Git 或 PrometheusRule。
- 限制 Alertmanager route 为测试/工作时段，保留静默、禁用或删除规则的回滚路径。
- 填入可访问的 Dashboard 与 Runbook 链接。
- 逐条以 live labels 预检 7 条表达式，仅选择 1 条告警完成 Pending → Firing → 路由 → 恢复的受控验证。

### SLO 固化前

- 连续采集至少 14 天 Gateway 请求、5xx 与 P95 基线。
- 确认 Tenant 真实业务 URI、调用方和最低合理样本量；无有效样本时不解释成功率。
- 完成 Gateway 单 Pod 可回滚演练及 Tenant metrics 断链桌面演练。
- 基于基线复核 Gateway 99.5% / 30d 与 P95 1.5s 的合理性，并评估告警重叠。

### Tenant 分位延迟

在 Tenant 应用配置层启用 `http.server.requests` histogram 及合理 SLA buckets，验证 `http_server_requests_seconds_bucket` 和时序基数后，再引入 P95/P99 Dashboard 与告警候选。
