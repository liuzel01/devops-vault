---
title: Kylin Admin parallel Ingress deployment review
created: 2026-04-07
updated: 2026-09-26
status: archived
owners: [liuzel01]
sources: ["local OpenClaw workspace review, migrated to this repository"]
source_kind: credential-redacted-operational-source
redaction: "Applied only to passwords, tokens, private keys, authorization headers, and cloud access-key material."
reviewed_by: liuzel01
---
# 2026-04-07 - hashdev: kylin-admin 独立 IngressClass/LB/Namespace 部署复盘（可直接执行）

## 目标
在不影响既有 `message-admin` 的前提下，为 `kylin-admin.dev.hhts88.com` 新增一套**独立**入口能力：
- 独立 IngressClass：`nginx-kylin-admin`
- 独立 ingress controller namespace：`ingress-kylin-admin`
- 独立 NLB + 独立 SG：`ingress-kylin-admin`

---

## 本次踩坑总结（先看）

### 坑 1：同一份 Terraform state + 不同 tfvars，会“替换”而不是“并存”
**现象**：`terraform apply -var-file=terraform.kylin-admin.tfvars` 在原 `nlbtls/terraform` 目录执行后，Terraform 将 `helm_release.service_admin` 识别为同一资源改名，导致先销毁 `message-admin` 再创建 `kylin-admin`。

**结论**：
- 需要“并行双套 ingress”时，必须使用**独立 state**（独立目录/独立 backend）
- 不能靠同目录切 tfvars 实现并存

### 坑 2：Ingress 里 regex path + `pathType: Prefix` 会被 webhook 拒绝
**现象**：
- `/api/thanos-admin/v1(/|$)(.*)`、`/otc-admin(/|$)(.*)`、`/swagger(/|$)(.*)`
- 在 `pathType: Prefix` 下被 `validate.nginx.ingress.kubernetes.io` 拒绝

**修复**：这些 regex 路径改为 `pathType: ImplementationSpecific`

### 坑 3：Route53 改了记录仍不通，不一定是 DNS 生效慢
**现象**：`kylin-admin.dev.hhts88.com` 有时能解析，但连接超时

**高概率原因**：NLB 到后端 NodePort 方向的安全组链路未完整放通（新 SG 与 worker node SG 规则未齐）

---

## 最终可复用执行方案（推荐 SOP）

> 下面是“可直接执行”的顺序，默认目标集群 `hashdev`

### 0) 前置确认
```bash
kubectl config use-context hashdev
```

### 1) 修改业务与 ingress 配置（kylin-admin）
文件：`nlbtls/kylin-admin/kylin-admin-values.yaml`
- `controller.ingressClass: nginx-kylin-admin`
- `controller.ingressClassResource.name: nginx-kylin-admin`
- `controller.ingressClassResource.controllerValue: k8s.io/ingress-kylin-admin`
- `controller.electionID: ingress-kylin-admin-leader`
- SG 注解改为占位（最终由 Terraform set 覆盖）

文件：`nlbtls/kylin-admin/kylin-admin-ingress.yaml`
- 所有资源明确 `namespace: default`（服务仍在 default）
- `ingressClassName: nginx-kylin-admin`
- regex 路径统一 `pathType: ImplementationSpecific`

### 2) 先确保 namespace 存在
```bash
kubectl apply -f nlbtls/kylin-admin/namespace-ingress-kylin-admin.yaml
```

### 3) 为 kylin-admin 使用独立 Terraform state（关键）
新目录（示例）：`nlbtls/terraform-kylin-admin/`
- 复制 `main.tf variables.tf outputs.tf`
- 使用独立 `terraform.tfvars`

`terraform.tfvars` 关键项：
- `ingress_release_name = "kylin-admin"`
- `ingress_namespace = "ingress-kylin-admin"`
- `ingress_values_path = "../kylin-admin/kylin-admin-values.yaml"`
- `ingress_manifest_path = "../kylin-admin/kylin-admin-ingress.yaml"`
- `create_nlb_security_group = true`
- `nlb_security_group_name = "ingress-kylin-admin"`
- `set_nlb_security_group_annotation = true`
- 复用已有 cert-manager IAM 角色/策略（避免重复创建冲突）：
  - `use_existing_cert_manager_role = true`
  - `use_existing_cert_manager_policy = true`

### 4) 执行 Terraform（独立目录）
```bash
cd nlbtls/terraform-kylin-admin
terraform init -upgrade
terraform plan
terraform apply -auto-approve
```

### 5) 验证（必须）
```bash
kubectl get ingressclass -o wide
kubectl get svc -n ingress-kylin-admin
kubectl get ingress -n default -o wide | egrep 'kylin-admin|message-admin'
```

预期：
- `nginx-admin` 与 `nginx-kylin-admin` 并存
- `message-admin` 与 `kylin-admin` 各自有独立 LB
- kylin 相关 ingress 的 CLASS 都是 `nginx-kylin-admin`

---

## DNS / 访问验证检查单

1. Route53 记录建议使用 `A (Alias)` 指向对应 NLB DNS（不要手填固定 A IP）
2. `message-admin.dev.hhts88.com` -> message-admin 的 NLB
3. `kylin-admin.dev.hhts88.com` -> kylin-admin 的 NLB
4. 若解析正常但访问超时：优先检查 SG 链路（LB SG -> node SG -> NodePort）

---

## 本次最终状态（截至记录时）
- `message-admin` 已恢复并正常
- `kylin-admin` 独立 ingress controller 已创建（namespace `ingress-kylin-admin`）
- 新 SG：`sg-02333352c164cf624`
- 新 LB：`k8s-ingressk-kylinadm-aae351eaf7-f5863b0a1ed76037.elb.ap-east-1.amazonaws.com`
- `kylin-admin` IngressClass 已生效：`nginx-kylin-admin`
