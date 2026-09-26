---
title: Cross-region PrivateLink review
created: 2026-04-09
updated: 2026-09-26
status: archived
owners: [liuzel01]
sources: ["local OpenClaw workspace review, migrated to this repository"]
source_kind: credential-redacted-operational-source
redaction: "Applied only to passwords, tokens, private keys, authorization headers, and cloud access-key material."
reviewed_by: liuzel01
---
# 2026-04-09 跨 Region PrivateLink 复盘（ap-east-1 ↔ ap-southeast-1）

## 1. 目标与背景

- 目标：让 `ap-southeast-1` 的 EKS 集群 `newmega` 内服务，访问 `ap-east-1` 的接口服务：`172.31.29.3:3000`（`/api/latest`）。
- 约束：
  - 两边 VPC 存在主 CIDR 重叠（均包含 `172.31.0.0/16`），无法直接做 VPC Peering。
  - 希望不影响现网服务，优先低侵入方案。

---

## 2. 前置排查与结论

### 2.1 VPC CIDR 冲突确认

- Provider VPC（ap-east-1）`vpc-0590c637681b267be`
  - `172.31.0.0/16`
  - `172.32.0.0/16`
- Consumer VPC（ap-southeast-1, newmega）`vpc-05c510cc88365b3f3`
  - `172.31.0.0/16`
  - `172.42.0.0/16`

**结论：主网段冲突，不能走直接 VPC Peering。**

### 2.2 方案选择

采用 **AWS PrivateLink（跨 Region）**：
- Provider：NLB + Endpoint Service
- Consumer：Interface VPC Endpoint

---

## 3. 实施过程（按时间顺序）

## 3.1 Provider 侧（ap-east-1）

### 3.1.1 创建目标组 + NLB + Listener

- Target Group：`lineurl-tg`
  - ARN: `arn:aws:elasticloadbalancing:ap-east-1:017820696647:targetgroup/lineurl-tg/2fdfd853deace572`
  - 协议端口：`TCP/3000`
  - target type：`ip`
  - 注册目标：`172.31.29.3:3000`

- NLB：`lineurl`（internal）
  - ARN: `arn:aws:elasticloadbalancing:ap-east-1:017820696647:loadbalancer/net/lineurl/79f52af6afa63622`
  - DNS: `lineurl-79f52af6afa63622.elb.ap-east-1.amazonaws.com`
  - 子网：
    - `subnet-072daf7efaf12d223`
    - `subnet-0e35fc8b0745a5374`

- Listener：`TCP/3000 -> lineurl-tg`

### 3.1.2 处理健康检查失败

现象：TG 一度 `Target.FailedHealthChecks`。

根因：实例 SG `sg-0b0caf4abf817388d` 的 `3000` 入站仅允许 `192.168.0.0/16`，未放行 NLB 子网来源。

修复：新增最小放行（3000/tcp）：
- `172.31.16.0/20`
- `172.31.32.0/20`

结果：目标变为 `healthy`。

### 3.1.3 创建 Endpoint Service

- Service ID：`vpce-svc-029fc6734d2d6d976`
- Service Name：`com.amazonaws.vpce.ap-east-1.vpce-svc-029fc6734d2d6d976`
- `AcceptanceRequired = true`
- Allowed Principal：`arn:aws:iam::017820696647:root`

> 备注：后续在控制台确认了支持区域包含 `ap-southeast-1`。

---

## 3.2 Consumer 侧（ap-southeast-1, newmega）

### 3.2.1 CLI 版本问题与处理

初始本地 AWS CLI 为 `2.15.16`，跨 Region PrivateLink 参数/行为不完整，导致：
- `InvalidServiceName`
- 无法正常传递 `--service-region`

处理：升级 AWS CLI 至 `2.34.27`（并验证 profile 不受影响）。

### 3.2.2 创建 Endpoint SG

- SG：`sg-0aa95d7fc2a97fb4f`
- 名称：`lineurl-ap-east-1-vpce-sg`
- 入站（3000/tcp）：
  - `172.31.0.0/16`
  - `172.42.0.0/16`

> 当前是“先打通”策略，后续可做收敛与加固。

### 3.2.3 创建 Interface Endpoint

- VPC Endpoint：`vpce-0dcad079bea2e27e4`
- Service：`com.amazonaws.vpce.ap-east-1.vpce-svc-029fc6734d2d6d976`
- Service Region：`ap-east-1`
- 子网：
  - `subnet-06f45dce0750d98df`
  - `subnet-095950d1049d70a63`
  - `subnet-01fc4c5f193aab98b`
- 状态流转：`pendingAcceptance -> pending -> available`

### 3.2.4 Provider 接受连接

- 在 ap-east-1 执行 accept 之后，连接与 endpoint 均进入可用状态。

---

## 4. 集群内接入方式调整（关键修正）

用户初版在 K8s 创建了：
- `Service + Endpoints(172.31.29.3:3000)`
- `Ingress`

问题：`Endpoints` 直指 provider 私网 IP，在 CIDR 重叠场景不推荐，且验证失败（connection refused）。

修正方案：
- 将 `lineurl-external` 改为 `ExternalName` Service，指向 VPCE DNS；
- 删除同名手工 Endpoints；
- Ingress 按需保留（仅内部调用其实不必依赖 ingress）。

最终检查：
- `Service lineurl-external` 为 `ExternalName` ✅
- `Endpoints lineurl-external` 不存在（符合预期）✅

---

## 5. 验证结果

### 5.1 私网链路验证

从 `flink-prod` 临时 Pod 验证：
- DNS 解析 `lineurl-external.default.svc.cluster.local` 成功，落到 VPCE 私网地址；
- `curl http://lineurl-external.default.svc.cluster.local:3000/api/latest` 返回 `HTTP/1.1 200 OK`；
- 临时测试 Pod 已自动删除。

**结论：EKS 内服务可通过 PrivateLink 正常调用 ap-east-1 目标接口。**

### 5.2 外部域名访问 504 排查与修复（新增）

现象：业务系统通过以下地址访问时报 `504 Gateway Time-out`：
- `https://yydsmg.dsffaw.com/lineurl/lines`
- `https://yydsmg.dsffaw.com/lineurl/probes/latest`

只读排查结果：
- Ingress `kylin-admin-lineurl` 的 rewrite 规则正确：`/lineurl(/|$)(.*) -> /api/$2`；
- 但 Ingress backend 指向 `lineurl-external:80`；
- 实测链路：
  - `lineurl-external:3000` 可用（`HTTP 200`）；
  - `lineurl-external:80` 超时；
  - 因此经 Ingress 反代后出现 `504`。

根因：**Ingress backend 端口配置错误（80），应使用 3000。**

修复：
- 将 `default/kylin-admin-lineurl` backend service port 从 `80` 调整为 `3000`。

修复后验证：
- 集群内直接访问：
  - `/api/lines`、`/api/probes/latest` 返回 `HTTP 200`；
- 外部域名路径（经 Ingress）：
  - `/lineurl/lines`、`/lineurl/probes/latest` 恢复可用。

---

## 6. 当前资源清单（最终）

### Provider（ap-east-1）
- NLB: `lineurl`
- TG: `lineurl-tg`
- Endpoint Service: `vpce-svc-029fc6734d2d6d976`
- Service Name: `com.amazonaws.vpce.ap-east-1.vpce-svc-029fc6734d2d6d976`

### Consumer（ap-southeast-1）
- Endpoint SG: `sg-0aa95d7fc2a97fb4f`
- Interface Endpoint: `vpce-0dcad079bea2e27e4`
- K8s Service: `default/lineurl-external`（ExternalName）
- （可选）Ingress: `default/kylin-admin-lineurl`（backend -> `lineurl-external:3000`）

---

## 7. 收敛与加固（补充版，建议按阶段执行）

> 目标：在已打通链路的前提下，逐步收敛权限与暴露面，避免影响现网。

### 7.1 阶段 A：先观测后收敛（建议 1~2 天）

1. 持续观测调用成功率与延迟（按 region/应用拆分）。
2. 记录真实调用来源（node 子网、pod 子网、业务命名空间）。
3. 保留当前放行规则作为兜底，避免收敛过早造成误伤。

### 7.2 阶段 B：Endpoint SG 收敛（consumer 侧）

当前（打通阶段）规则：
- `sg-0aa95d7fc2a97fb4f` 允许 `172.31.0.0/16`、`172.42.0.0/16` 访问 `tcp/3000`。

建议收敛目标：
1. 只保留真实调用源 CIDR（优先 /24 或更小网段）。
2. 如路径清晰可控，改为同 VPC 内 SG 引用（比大网段 CIDR 更精确）。
3. 收敛采用“先加后减”：
   - 先新增精确规则；
   - 观察无异常后，再删除宽泛规则。

### 7.3 阶段 C：Provider 实例 SG 收敛（ap-east-1）

当前实例 SG（`sg-0b0caf4abf817388d`）已允许 NLB 子网访问 3000：
- `172.31.16.0/20`
- `172.31.32.0/20`

建议：
1. 保留仅 NLB 必需来源（避免扩大到整段 VPC）。
2. 定期核对 NLB 子网是否变更（扩容/迁移后同步更新规则）。
3. 禁止临时放开的调试规则长期残留。

### 7.4 阶段 D：K8s 入口面收敛

1. 内部系统调用优先走 `ExternalName`（`lineurl-external`）+ 私网链路。
2. 若非必须对外暴露，建议下线不必要 Ingress。
3. 若保留 Ingress：
   - 固定 backend 端口为 `3000`（本次 504 根因即端口误配 80）；
   - 通过 allowlist / auth / rate-limit 限制外部访问面。

### 7.5 阶段 E：可观测与告警

建议至少补齐以下告警：
1. VPCE 状态异常（`available` 以外）。
2. NLB Target 健康异常（`unhealthy` 持续 N 分钟）。
3. 关键接口 SLI：
   - `5xx` 比例
   - P95/P99 延迟
   - 跨 region 探针成功率

### 7.6 阶段 F：变更与回滚规范

每次收敛变更都要有：
1. 变更前快照（SG/Ingress/Service YAML）。
2. 小步发布（单规则或单对象）。
3. 即时回归验证：
   - 集群内：`lineurl-external...:3000/api/*`
   - 外部（如保留 Ingress）：`https://yydsmg.dsffaw.com/lineurl/*`
4. 预置回滚命令，验证失败立即恢复。

### 7.7 本次建议的最小执行清单（待窗口执行）

1. 确认真实调用源网段（应用 + namespace）。
2. 在 `sg-0aa95d7fc2a97fb4f` 新增精确来源规则。
3. 观察 24h 无异常后，删除 `172.31.0.0/16`、`172.42.0.0/16` 宽规则。
4. 复测：
   - `flink-prod` Pod 内 curl 两个核心 API；
   - 外部域名路径（如 Ingress 保留）
5. 记录变更单与回滚单。

---

## 8. 关键经验

- 跨 Region PrivateLink 对 CLI 版本敏感，过旧 CLI 会出现参数缺失与 `InvalidServiceName` 误导。
- `AcceptanceRequired=true` 时，“allowed principal” != 自动放通，仍需显式 accept。
- K8s 场景中若采用 ExternalName，不应再维护同名 Endpoints。
- 在“先打通再收敛”的节奏下，先确认业务可用，再做最小权限收敛，推进更稳。
