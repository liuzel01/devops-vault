---
title: Review - Cross-region PrivateLink
created: 2026-09-26
updated: 2026-11-17
type: review
status: published
publish: true
tags: [aws, privatelink, eks, networking, troubleshooting]
owners: [liuzel01]
sources: ["sources/reviews/2026/2026-04-09-ap-east-1-ap-southeast-1-privatelink-review.md"]
generated:
  tool: openclaw
  model: null
  reviewed_by: liuzel01
---

# Review - Cross-region PrivateLink

## 背景与范围

由于 `ap-east-1` 与 `ap-southeast-1` VPC 主 CIDR 重叠，无法使用 VPC Peering。本次覆盖跨 Region PrivateLink、EKS 内部接入、Ingress 访问及安全收敛建议。

## 结论

- 已采用 NLB、Endpoint Service 与 Interface VPC Endpoint 构建跨 Region PrivateLink 链路。
- EKS 内服务可通过 `ExternalName` Service 访问目标接口，并验证返回 HTTP 200。
- 外部访问 504 的原因是 Ingress backend 端口为 80，调整为 3000 后恢复。
- 后续安全收敛与变更清单仍属建议或待窗口执行事项。

## 证据与来源

- 来源：[`2026-04-09 PrivateLink 凭证脱敏源文档`](../../sources/reviews/2026/2026-04-09-ap-east-1-ap-southeast-1-privatelink-review.md)。
- 证据包括 CIDR 冲突、PrivateLink 资源状态、Target 健康、EKS 内 DNS/HTTP 验证和端口修复回归结果。
- 完整源档案保留原始结构，仅将凭据替换为具名变量。

## 风险与后续行动

- 按真实调用来源逐步收敛 Endpoint SG、Provider 实例 SG 与 Ingress 暴露面。
- 补齐 VPCE、NLB Target、接口成功率与跨 Region 探针告警；每次变更保存快照并准备回滚。
