---
title: Review - Hashdev ACME certificate service
created: 2026-09-26
updated: 2026-09-26
status: draft
owners: [liuzel01]
sources: ["sources/reviews/2026/2026-04-19-hashdev-acme-certificate-service-review.md"]
generated:
  tool: openclaw
  skill: review
  skill_version: null
  reviewed_by: null
---

# Review - Hashdev ACME certificate service

## 背景与范围

本次复盘针对 `hashdev` 集群 ACME 证书服务，覆盖 cert-manager、Route53 DNS-01、ClusterIssuer、证书签发、新域名接入及故障排查，并检查部署 README 的 SOP 覆盖度。

## 结论

- 源记录显示 cert-manager 运行中，staging/prod ClusterIssuer 为 Ready，现有证书及 Order/Challenge 有效。
- 关键配置与集群现状一致，可支持继续新增域名并自动签发 TLS。
- README 已覆盖架构、前置条件和基础验证，但缺少完整实际变量步骤、新域名示例和明确故障排查顺序。
- 建议新域名一律经 PR、Terraform `plan` 与人工确认后接入，并固定 cert-manager 版本。

## 证据与来源

- 来源：[`2026-04-19 Hashdev ACME 凭证脱敏源文档`](../../sources/reviews/2026/2026-04-19-hashdev-acme-certificate-service-review.md)。
- 证据包括 cert-manager Pod、ClusterIssuer、Certificate、CertificateRequest、Order、Challenge 与配置一致性核查。
- 完整源档案保留原始结构，仅将凭据替换为具名变量。

## 风险与后续行动

- `cert_manager_manifest_url` 使用 `latest` 存在版本漂移风险，应固定版本。
- 异常时依次检查组件、Issuer、任务对象、控制器日志、IRSA、Hosted Zone、DNS 传播与 ACME 连通性。
