---
title: AWS Mega slow-query remediation review
created: 2026-04-07
updated: 2026-11-17
status: archived
owners: [liuzel01]
sources: ["local OpenClaw workspace review, migrated to this repository"]
source_kind: credential-redacted-operational-source
redaction: "Applied only to passwords, tokens, private keys, authorization headers, and cloud access-key material."
reviewed_by: liuzel01
---
# AWS `mega` 慢查询治理复盘（2026-04-07）

## 1) 范围与目标

- 环境：`aws profile=mega`，region=`ap-southeast-1`
- 目标：
  1. 核查 EC2 资源监控（CPU/MEM/DISK）覆盖
  2. 优化 RDS MySQL 慢查询通知链路（CloudWatch Logs -> Lambda -> Lark）
  3. Mongo 慢日志按库拆分并分 webhook 通知（repl / kline / data）

---

## 2) EC2 资源监控核查与补齐

### 初始状态
- 运行中 EC2：49 台
- 三维指标齐全（CPU + MEM + DISK）：46 台
- 缺口 3 台（其中 2 台 Windows，本次排除）

### 本次处理
- 对 Linux 缺口实例 `i-0ca1bb07ff3b2322b` 补 CloudWatch Agent 配置并重载 agent 服务
- 用既有脚本补告警（不重启 EC2，不停机）

### 结果
- 运行中 Linux EC2：47 台
- 三维指标齐全：47/47

---

## 3) RDS(MySQL) 慢查询链路核查

### 对应关系确认
- RDS 实例：`meganew`（MySQL）
- 慢日志组：`/aws/rds/instance/meganew/slowquery`
- 订阅目标：Lambda `mega-rds-lark`
- 当前 webhook（函数内/环境变量）：`<LARK_WEBHOOK_PATH_REDACTED>`

### `mega-rds-lark` 本次优化
- Phase 1 已上线：
  - 慢查询阈值（`SLOW_THRESHOLD_SEC`）
  - SQL 指纹聚合
  - 去重窗口（`DEDUP_WINDOW_SEC`）
  - TopN 汇总通知（`TOPN`）
- 参数已改为环境变量可配置

---

## 4) Mongo 慢日志拆分方案（已落地）

## 设计
- 1 个 Lambda：`mongo-slowquery`
- 3 个日志组：
  - `/mongo/repl/slowquery`
  - `/mongo/kline/slowquery`
  - `/mongo/data/slowquery`
- 3 个 webhook（按日志组路由）

## 已执行
1. `mongo-slowquery` 升级为“按 logGroup 路由 webhook”，并发布版本（已到 `:2`）
2. 在 repl 两台副本节点部署 `fluent-bit-mongo-repl`，输出 `/mongo/repl/slowquery`
3. 在 kline/data 节点分别部署 `fluent-bit-mongo-kline` / `fluent-bit-mongo-data`
4. 为三日志组分别添加 Lambda invoke permission + subscription filter

## webhook 路由
- repl: 维持原 webhook
- kline: `<LARK_WEBHOOK_URL_REDACTED>`
- data: `<LARK_WEBHOOK_URL_REDACTED>`

---

## 5) 问题与修复（关键经验）

### 问题 A：`MIN_DURATION_MS=800` 仍出现 <800ms 告警
- 原因：旧逻辑对 `COLLSCAN` 分支有放行路径，绕过时长阈值
- 修复：统一先过 `duration >= MIN_DURATION_MS` 再发送（无论是否 COLLSCAN）
- 结果：发布 `mongo-slowquery:2`

### 问题 B：优化建议出现“相关字段”，可读性差
- 修复：
  - 有 filter 字段：提示基于具体字段组合评估索引
  - 无 filter 字段：明确提示需结合样例查询 + explain
  - 卡片增加 `查询样例(command)` 字段，提升可排查性

---

## 6) 当前参数基线（便于复用）

### `mongo-slowquery`
- `MIN_DURATION_MS=800`（当前人工调整值）
- `DEDUP_TTL_MS=120000`
- `EXCLUDED_OPERATIONS=delete,remove`
- `WEBHOOK_REPL` / `WEBHOOK_KLINE` / `WEBHOOK_DATA` 已配置

### `mega-rds-lark`
- `SLOW_THRESHOLD_SEC=1`
- `DEDUP_WINDOW_SEC=120`
- `TOPN=5`
- `LARK_WEBHOOK_PATH` 已配置

---

## 7) 低风险操作边界（本次遵循）

- 未重启 EC2
- 未关停 EC2
- 未重启 mongod / 未改数据库服务参数
- 仅修改：日志采集容器、CloudWatch Logs 订阅、Lambda 代码与配置

---

## 8) 后续可选优化（未执行）

1. `mega-rds-lark` timeout 3s -> 10s（降低批量日志抖动风险）
2. 通知补 `logStream + timestamp` 便于回溯 CloudWatch 原始事件
3. 若并发增大，可把去重从内存迁移到 DynamoDB TTL（跨实例稳态）
