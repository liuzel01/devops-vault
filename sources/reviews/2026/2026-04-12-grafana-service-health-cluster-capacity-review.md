---
title: Grafana service health and cluster capacity review
created: 2026-04-12
updated: 2026-09-26
status: archived
owners: [liuzel01]
sources: ["local OpenClaw workspace review, migrated to this repository"]
source_kind: credential-redacted-operational-source
redaction: "Applied only to passwords, tokens, private keys, authorization headers, and cloud access-key material."
reviewed_by: liuzel01
---
# 2026-04-12 Grafana 看板改造复盘（Hash 环境）

## 背景

本次目标是把 Hash 监控从“单一排障视角”扩展为：

1. 保留原有深度排障看板（Pod/Node 资源细粒度定位）
2. 新建面向值班的 Service Health + Cluster Capacity 看板
3. 校正若干查询与面板行为不一致问题（变量联动、时间窗口语义、表格转换）

---

## 一、原有看板改造（深度排障）

### 1) 目标看板

- Dashboard：`Hash: Pod Restart & Resource Triage`
- UID：`cfgqv62mmipkwc`

### 2) 关键改动

#### A. CPU 面板语义调整与 node 映射

- `Pod CPU Usage (cores, 5m rate)` 改为 default 命名空间 Top10，并展示 `namespace/pod => node`
- `Workload CPU Share (%)` 改为 pod 维度（`Pod CPU Share (%)`），避免“workload”语义误导

#### B. 新增 namespace 维度 Pod CPU 视图

- 新增面板：`Namespace Pod CPU Usage (cores, 5m rate) - Top50`
- 支持左上角 namespace/pod 变量联动
- legend 统一：`{{namespace}}/{{pod}} => {{node}}`

#### C. 新增 namespace 维度 Pod Memory 视图

- 新增面板：`Namespace Pod Memory Usage (working set) - Top50`
- 与 CPU 面板口径一致，便于横向对比

#### D. Node 资源视图补充

新增 4 个 node 聚合面板（按 selected namespace/pod）：

- Node CPU Usage (%)
- Node CPU Used (cores)
- Node Memory Usage (%)
- Node Memory Used (bytes)

#### E. 描述信息完善

- 给当前看板主要 panel 补充 description，方便交接与值班同学理解指标含义

---

## 二、新建值班看板（Service Health + Capacity）

### 1) 新看板信息

- Dashboard：`Hash: Service Health & Cluster Capacity`
- UID：`ffiudbqfo9ddsd`
- 说明：用于值班总览，原排障看板保留做深度定位

### 2) 首版核心面板

#### Service Health

- Deployment Ready Ratio (%) - Top20
- StatefulSet Ready Ratio (%) - Top20
- CrashLoopBackOff Pods by Namespace
- Pending/Unknown Pod Count by Namespace
- Pending/Unknown Pod Detail (Table)

#### Cluster Capacity

- Cluster CPU Usage (%)
- Cluster Memory Usage (%)
- Node CPU Usage (%)（后续修正为 All Nodes）
- Node Memory Usage (%)（按 selected namespace）
- Node NotReady Count
- Unschedulable Node Count
- Unschedulable Node Detail (Table)
- Node CPU Usage Current (%) (Table)

---

## 三、问题排查与修复记录（关键）

### 问题 1：`${datasource} not found`

**现象**：新加面板无数据，报 datasource 变量不存在。  
**根因**：面板 datasource uid 写成 `${datasource}`，但该看板无此变量。  
**修复**：改为实际 Prometheus datasource uid（与现有 panel 保持一致）。

### 问题 2：Pending/Unknown 面板纵轴始终 1

**现象**：用户认为图不直观。  
**根因**：按 pod 序列绘图本质是 0/1 状态值。  
**修复**：拆成两层：

- 主图：按 namespace 统计总数（趋势）
- 明细：Table 展示具体 pod/node/phase

### 问题 3：Unschedulable Count 与 Detail 不一致

**现象**：`count=3`，detail 无数据或只一条。  
**根因（组合）**：

1. 查询口径与时间窗口语义不一致（瞬时 vs 区间）
2. table transformation 把多序列错误合并，未按行展开
3. 未按 node 去重

**修复**：

- Count：`sum(max by(node) (max_over_time(kube_node_spec_unschedulable[$__range])) == 1)`
- Detail：`max by(node) (max_over_time(kube_node_spec_unschedulable[$__range])) == 1`
- 表格转换改为按序列展开为多行，确保每个 node 一行

### 问题 4：Node CPU Usage 仅显示单值

**现象**：看不到所有 node。  
**根因**：`node_cpu_seconds_total` 在当前数据里不含 `node` 标签，按 `node` 分组导致被聚合成单条。  
**修复**：按 `instance` 分组：

- `100 * (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])))`
  并同步修正明细表，按 instance 逐行展示。

---

## 四、外部导入看板审查与增强

### 1) 导入看板

- Dashboard：`K8s Node Metrics / Multi Clusters (Node Exporter, Prometheus, Grafana11, 2025, EN)`
- UID：`your_custom_uid_X0dfg`

### 2) 适用性结论

可作为“节点资源层值班看板”，覆盖 CPU/内存/磁盘/网络/load/iowait/fd/IOPS/时延等核心 Node 指标。  
但它不覆盖业务层健康（如 ready、CrashLoop、5xx、延迟/SLO），需与 Service Health 看板配合。

### 3) 文档化增强

- 已为该看板各 panel 补充 description（共 24 个）
- 将一个空标题 panel 命名为 `CPU Basic Breakdown`

---

## 五、当前看板分工（最终建议）

### 1) 深度排障看板

- `Hash: Pod Restart & Resource Triage`
- 用途：Pod/Node 维度异常定位、资源细粒度分析

### 2) 值班总览看板

- `Hash: Service Health & Cluster Capacity`
- 用途：服务健康态势 + 集群容量压力（值班入口）

### 3) 节点资源专用看板（导入）

- `K8s Node Metrics / Multi Clusters ...`
- 用途：Node OS 资源层面深度观察

三者组合可形成“告警/总览 → 容量判断 → 细节排障”的闭环。
