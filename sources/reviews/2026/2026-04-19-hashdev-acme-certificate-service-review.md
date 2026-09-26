---
title: Hashdev ACME certificate service review
created: 2026-04-19
updated: 2026-09-26
status: archived
owners: [liuzel01]
sources: ["local OpenClaw workspace review, migrated to this repository"]
source_kind: credential-redacted-operational-source
redaction: "Applied only to passwords, tokens, private keys, authorization headers, and cloud access-key material."
reviewed_by: liuzel01
---
# hashdev 集群 ACME 证书服务复盘（2026-04-19）

## 1. 结论先行

- `nlbtls/README.md` **有说明**部署与 ACME 使用思路，但偏“总览/检查清单”，不是可直接照抄执行的完整 SOP。
- 目前 `hashdev` 集群中 ACME 链路状态正常：
  - cert-manager 组件运行正常（controller/cainjector/webhook 全 Running）
  - ClusterIssuer（staging/prod）Ready=True
  - 证书资源 Ready=True，Order/Challenge 为 valid
- 本文整理为可执行复盘：包括部署 ACME、新增域名接入、签发验证、服务健康检查。

---

## 2. README 覆盖度检查（`nlbtls/README.md`）

README 已覆盖：

- 架构目标（独立 ingress-nginx + cert-manager + Route53 DNS-01）
- 基础前置条件
- 关键资源文件位置
- 验证清单（pods/issuer/certificate/challenge/curl）
- 常见注意点（IRSA sub、staging/prod 注解）

README 未细化或需要补充的点：

- 缺少“按 hashdev 真实变量落地”的一步一步流程
- 缺少“新增一个新域名时，Ingress/证书/验证的完整链路示例”
- 缺少故障定位顺序（先看哪个对象、哪个日志、哪个权限）

---

## 3. hashdev 当前运行基线（本次核查）

### 3.1 集群与组件

- kube context: `hashdev`
- namespace: `cert-manager` 存在
- Pod 状态：
  - cert-manager: Running
  - cert-manager-cainjector: Running
  - cert-manager-webhook: Running

### 3.2 证书颁发器

- `ClusterIssuer/letsencrypt-dns-prod`: Ready=True
- `ClusterIssuer/letsencrypt-dns-staging`: Ready=True

### 3.3 证书链路

- `Certificate/kylin-admin-tls`: Ready=True
- `Certificate/message-admin-tls`: Ready=True
- 关联 `CertificateRequest` 均为 Ready=True
- `Order`/`Challenge` 状态为 valid

### 3.4 与本地仓库配置一致性

`lemo` 分支下（`nlbtls/terraform-kylin-admin/terraform.tfvars`）关键项与 hashdev 现状一致：

- `cluster_name = "hashdev"`
- `aws_profile = "hashex"`
- `apply_clusterissuer_staging = true`
- `apply_clusterissuer_prod = true`
- ingress release/namespace/values/manifest 指向 kylin-admin 相关文件

---

## 4. 如何部署 ACME 证书颁发服务（以 hashdev 为例）

> 目标：在 EKS 中启用 cert-manager + Route53 DNS-01 + ClusterIssuer。

### 4.1 前置条件

1. 可访问 hashdev 集群
2. AWS 账号具备 EKS/IAM/Route53 权限
3. 已有 Route53 Hosted Zone
4. EKS OIDC Provider 已就绪（或允许 Terraform 创建）

### 4.2 Terraform 入口（建议）

目录：`~/gitlab/kylin-script/nlbtls/terraform-kylin-admin`

关键逻辑（main.tf）：

- `null_resource.cert_manager_install`：`kubectl apply -f cert-manager manifest`
- `null_resource.cert_manager_sa_annotate`：为 cert-manager SA 注入 IRSA role
- `null_resource.clusterissuer_staging/prod`：apply ClusterIssuer YAML

执行：

```bash
cd ~/gitlab/kylin-script/nlbtls/terraform-kylin-admin
terraform init
terraform plan
terraform apply
```

### 4.3 部署后最小检查

```bash
kubectl get pods -n cert-manager
kubectl get clusterissuer
```

预期：组件 Running，Issuer Ready=True。

---

## 5. 如何新增一个域名并使用该集群 ACME 证书

> 示例：新增 `new-admin.dev.hhts88.com`（流程同现有 kylin/message-admin）。

### 5.1 准备 Ingress

在目标 namespace（这里示例 default）新增 Ingress，关键要点：

- 指定 ingressClassName（如 `nginx-kylin-admin`）
- 设置 cert-manager 注解指向 issuer（建议生产 `letsencrypt-dns-prod`）
- `tls.hosts` 包含新域名
- `tls.secretName` 指定新证书 secret

示例（精简）：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: new-admin-web
  namespace: default
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-dns-prod"
spec:
  ingressClassName: nginx-kylin-admin
  tls:
    - hosts:
        - new-admin.dev.hhts88.com
      secretName: new-admin-tls
  rules:
    - host: new-admin.dev.hhts88.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: your-service
                port:
                  number: 80
```

应用：

```bash
kubectl apply -f <your-ingress>.yaml
```

### 5.2 Route53 侧准备

- 确保业务域名 `new-admin.dev.hhts88.com` 指向 ingress 对应 NLB
- cert-manager 在签发时会自动写 `_acme-challenge` 记录（通过 IRSA + Route53 权限）

### 5.3 观察签发过程

```bash
kubectl get certificate -n default
kubectl get certificaterequest -n default
kubectl get order -n default
kubectl get challenge -n default
```

预期：最终 `Certificate Ready=True`，Order/Challenge 进入 valid。

---

## 6. 如何检查“证书是否颁发成功”

### 6.1 Kubernetes 资源维度

```bash
kubectl get certificate -n default
kubectl describe certificate -n default <cert-name>
```

关注点：

- `Type=Ready, Status=True`
- Message: `Certificate is up to date and has not expired`
- `Not Before / Not After / Renewal Time`

### 6.2 Secret 维度

```bash
kubectl get secret -n default <tls-secret-name>
```

预期：secret 存在（类型通常为 `kubernetes.io/tls`）。

### 6.3 入口访问维度

```bash
curl -vk https://<domain>
```

预期：TLS 握手成功，证书域名匹配，无明显证书错误。

---

## 7. 如何检查 ACME 服务运行正常

建议按“组件 -> 颁发器 -> 任务对象 -> 日志”顺序看：

### 7.1 组件健康

```bash
kubectl get pods -n cert-manager
kubectl get deploy -n cert-manager
```

### 7.2 Issuer 健康

```bash
kubectl get clusterissuer
kubectl describe clusterissuer letsencrypt-dns-prod
```

关键：Ready=True，且无注册失败类报错。

### 7.3 近期签发任务

```bash
kubectl get certificaterequests,orders,challenges -A
```

关键：是否持续出现 failed/pending 卡住。

### 7.4 控制器日志

```bash
kubectl logs -n cert-manager deploy/cert-manager --since=24h
```

关键：是否出现 Route53 权限、DNS 传播、ACME account 错误。

---

## 8. 常见故障与排查要点

1. **Issuer NotReady**
   - 检查 ACME server URL、邮箱、网络连通性

2. **Challenge 一直 pending/failed**
   - 优先查 IRSA 与 Route53 权限（role/policy/trust policy sub）
   - 检查 Hosted Zone 是否匹配

3. **Certificate 不生成**
   - Ingress 注解 issuer 名拼写错误
   - `ingressClassName` 不匹配导致控制器未接管
   - 目标 service 不存在（虽不一定阻断签发，但会影响入口验证）

4. **配置漂移风险**
   - `cert_manager_manifest_url` 指向 latest，未来建议固定版本（避免不可控漂移）

---

## 9. 建议的团队操作规范（简版）

- 新域名接入统一走 PR：Ingress +（必要时）values/vars 变更
- 上线前固定检查四项：
  1) cert-manager pods
  2) clusterissuer ready
  3) certificate ready
  4) curl https 验证
- Terraform apply 前必须先 `plan` 并人工确认
- 尽量固定 cert-manager 安装版本，减少“latest”带来的不确定性

---

## 10. 本次复盘结论

- hashdev 的 ACME 证书服务当前部署成功、运行成功。
- 你给的 `lemo` 分支配置与线上现状一致，能支撑继续新增域名并自动签发 TLS。
- 文档层面：`nlbtls/README.md` 有基础说明，但本复盘补齐了可执行 SOP 与排查流程。
