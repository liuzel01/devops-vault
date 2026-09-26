---
title: Hashdev EKS deployment retrospective
created: 2026-04-01
updated: 2026-09-26
status: archived
owners: [liuzel01]
sources: ["local OpenClaw workspace review, migrated to this repository"]
source_kind: credential-redacted-operational-source
redaction: "Applied only to passwords, tokens, private keys, authorization headers, and cloud access-key material."
reviewed_by: liuzel01
---
# 2026-04-01 hashdev EKS 部署复盘（给下次新环境复用）

## 目标

- 在新 EKS 环境快速拉起可用业务：服务可启动、可访问依赖、核心链路健康。
- 重点避免“看起来部署了但实际运行失败”的隐性问题（RBAC、DB schema、连接上限、启动窗口）。

---

## 一、部署前准备（必须）

### 0) 参数先收敛（先填再做）

- 集群：`<cluster>`（示例：`hashdev`）
- Region/可用区：`<region>/<az>`（示例：`ap-east-1/ap-east-1a`）
- 命名空间：`<namespace>`（本次核心业务为 `default`，ingress-controller 建议 `ingress-nginx`）
- VPC/子网：`<vpc-id>/<subnet-ids>`
- Ingress 与域名：`<ingress-class>`、`<hosted-zone>`、`<acm-arn>`
- 镜像拉取密钥：`<IMAGE_PULL_SECRET>`（避免占位符未替换）

### 1) 环境与访问

- 确认 kubectl context 指向目标集群（如 `hashdev`）。
- 确认 namespace（本次多个服务实际跑在 `default`，不是 `hashdev` 命名空间）。
- 确认 Harbor/镜像仓库拉取凭据（imagePullSecrets）。

### 2) 基础依赖

- MySQL / MongoDB / Redis / Kafka / xxl-job-admin 的地址、账号、端口提前核对。
- 需要提前校验：网络可达 + 认证可用（仅端口通不代表能用）。

### 3) 配置基线

- 关键 ConfigMap（示例）：
  - `admin-multi-source-config`
  - `env-config`
  - `xxl-job-config`
  - `tiger-config`
  - `data-center-config`
- 注意：同名服务可能实际只加载部分 ConfigMap，不能“改了某个 configmap 就默认生效”。

---

## 二、资源创建顺序（推荐）

1. **RBAC/ServiceAccount**（先上）
   - 先创建读 ConfigMap 的 Role/RoleBinding。
   - 本次关键文件：
     - `k8s-yaml/role/list-services-role.yaml`
     - `k8s-yaml/role/list-services-rolebinding.yaml`
   - 若缺失，Spring Cloud Kubernetes 会报 Forbidden，导致回退到 jar 默认配置。

2. **ConfigMap/Secret**（再上）
   - 先 apply 配置，再部署业务。
   - 多数据源项目优先核对每个 datasource 指向的库是否正确。

3. **中间件与基础服务**
   - `xxl-job-admin` 先启动并就绪，再让 executor 启动（减少注册失败噪音）。

4. **业务 Deployments/StatefulSets**
   - 分批 rollout，避免全量同时重启引发 DB/Mongo 连接风暴。

5. **上线后验证**
   - rollout status + pod logs + events 三件套。

---

## 三、本次暴露的高频坑位（重点）

### A. RBAC 缺失导致“配置未生效”

- 现象：
  - 日志出现 `Unable to get ConfigMap ... Forbidden`。
  - 服务回退到 application.yml 默认值（例如错误 DB、`localhost:9094` Kafka）。
- 处理：
  - 先补 Role/RoleBinding，再 rollout restart。

### B. MySQL 报错链路要区分“根因”和“退出伴生报错”

- 常见伴生报错：`CannotGetJdbcConnectionException`、`HikariDataSource has been closed`。
- 本次真实根因之一：
  - `Unknown column 'condition_type'`（代码版本与 DB schema 不匹配）。
- 处理：
  - 优先找第一条 SQL 语法/字段报错，按版本补 DDL，而不是只盯 JDBC 超时字样。

### C. MongoDB 连接拒绝（too many open connections）

- 现象：
  - Mongo 日志：`Connection refused because there are too many open connections`。
- 本次有效处理：
  - 提升容器 `ulimit nofile` 到 `65535`。
  - 增加 `--maxConns 2000`。
- 建议长期方案：
  - 应用侧统一下调连接池，避免高并发重启时打爆连接。

### D. xxl-job-admin 存在“启动窗口”

- 现象：executor 注册报 `Connection refused`。
- 实际原因：admin 端口未就绪/启动慢窗口，不是服务不存在。
- 处理：
  - 给 admin 配 `startupProbe/readinessProbe`，必要时增加副本。

### E. 数据库表结构异常（不仅是缺字段）

- 案例：`kylin-admin-kylin-admin-impl` 报 `Unknown column source/c.source`。
- 本次以最终排查为准：核心问题在 `spot.tbl_channel`、`spot.tbl_channel_statistic` 与代码期望不一致（并非仅 jituan 库）。
- 处理原则：
  - 先确认**实际数据源库**（不要只看报错里的别名）；
  - 先备份，再按稳定环境（hash）做结构同步；
  - 优先最小变更（先补字段，再看类型），避免直接重建表。

---

## 四、网络与调度（本次新增的关键经验）

### 1) 识别是否为子网 IP 耗尽

- 典型现象：Pod 长时间 `ContainerCreating`，事件里反复出现 `aws-cni failed to assign an IP address`。
- 核心判断：节点所在子网 `AvailableIpAddressCount` 接近 0（本次 `172.32.2.0/24` 即为 0）。

### 2) 修复路径（优先同 AZ）

1. 在同 AZ 新增可用子网（避免跨 AZ 通信成本）；
2. 新建/重建 nodegroup 绑定新子网；
3. 关键前端/新业务先用 `nodeSelector` 临时收敛到新 nodegroup；
4. 服务恢复后，再评估是否取消临时 `nodeSelector` 回归常态调度。

### 3) 同步配置，避免“集群改了但仓库没改”

- 线上临时 patch（`set image` / `nodeSelector` / `imagePullSecrets`）完成后，务必同步回本地 YAML 并提交。
- 否则下次 `kubectl apply` 会把修复覆盖掉。

---

## 五、建议的验收清单（每次新环境都跑）

1. **K8s 面**

- deployment/statefulset 全部 `Available`。
- 无持续 `CrashLoopBackOff/ImagePullBackOff`。
- events 无持续失败事件。

1. **配置面**

- 服务日志中无 `Forbidden get ConfigMap`。
- 关键配置值已按预期加载（DB/Kafka/Mongo 地址非默认值）。

1. **依赖面**

- MySQL: 连接成功 + 核心表结构字段齐全。
- Mongo: 无 `too many open connections`，连接数可用余量健康。
- xxl-job-admin: executor 注册成功。

1. **业务面**

- 核心服务无启动阶段 SQL 语法错误。
- 关键接口 smoke test 通过。

---

## 六、部署文件与目录（本次用到）

- 配置文件目录：
  - `k8s-yaml/configmap/`
  - 核心：`admin-multi-source-configmap.yaml`
- 权限目录：
  - `k8s-yaml/role/`
  - 核心：`list-services-role.yaml`、`list-services-rolebinding.yaml`

> 备注：后续新环境部署时，优先用这两类文件做“先权限、后配置、再部署”的基线流程。

---

## 七、下次新 EKS 环境的一键化建议（给开发/AI）

- 把流程固化为 4 个阶段脚本：
  1. `00-rbac`
  2. `01-config`
  3. `02-middleware`
  4. `03-services + healthcheck`
- healthcheck 输出统一成 checklist 报告（通过/失败 + 修复建议）。
- 明确“失败即停”条件：
  - 出现 RBAC Forbidden、DB schema mismatch、Mongo 连接打满，禁止继续批量重启。
