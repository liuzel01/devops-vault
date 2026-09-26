---
title: Review - Kylin Admin parallel Ingress deployment
created: 2026-09-26
updated: 2026-09-26
status: draft
owners: [liuzel01]
sources: ["sources/reviews/2026/2026-04-07-kylin-admin-ingress-parallel-deployment-review.md"]
generated:
  tool: openclaw
  skill: review
  skill_version: null
  reviewed_by: null
---

# Review - Kylin Admin parallel Ingress deployment

## 背景与范围

为 `kylin-admin.dev.hhts88.com` 新增独立入口能力，同时保持既有 `message-admin` 不受影响，范围包括独立 IngressClass、Ingress Controller Namespace、NLB 与安全组。

## 结论

- 并行部署必须使用独立 Terraform state，不能仅通过同目录切换 tfvars 实现。
- Regex 路径必须使用 `pathType: ImplementationSpecific`，否则会被 Ingress webhook 拒绝。
- 源记录显示 `message-admin` 已恢复正常，`kylin-admin` 独立 Ingress Controller 与 IngressClass 已创建。
- DNS 解析正常但访问超时时，应优先检查 NLB 安全组、Worker Node 安全组及 NodePort 放通链路。

## 证据与来源

- 来源：[`2026-04-07 Kylin Admin 凭证脱敏源文档`](../../sources/reviews/2026/2026-04-07-kylin-admin-ingress-parallel-deployment-review.md)。
- 关键证据包括 Terraform 资源替换现象、Ingress webhook 拒绝记录、独立 Namespace/IngressClass 配置及资源状态。
- 完整源档案保留原始结构，仅将凭据替换为具名变量。

## 风险与后续行动

- 使用独立 Terraform 目录与 state，先 `init`、`plan` 后再 `apply`。
- 完成 DNS、NLB、Worker Node SG、NodePort 与实际访问链路验证，并保留结果。
