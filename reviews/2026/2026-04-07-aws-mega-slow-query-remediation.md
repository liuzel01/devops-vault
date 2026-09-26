---
title: Review - AWS Mega slow-query remediation review
created: 2026-09-26
updated: 2026-09-26
status: draft
owners: [liuzel01]
sources: ["sources/reviews/2026/2026-04-07-aws-mega-slow-query-remediation-review.md"]
generated:
  tool: openclaw
  skill: review
  skill_version: null
  reviewed_by: null
---

# Review - AWS Mega slow-query remediation review

## 背景与范围

本次复盘覆盖 `aws profile=mega`、`ap-southeast-1`：

- 核查 EC2 CPU、内存、磁盘监控覆盖情况。
- 优化 RDS MySQL 慢查询通知链路。
- 按库拆分 Mongo 慢日志并分 webhook 通知。
- 变更范围限于日志采集容器、CloudWatch Logs 订阅、Lambda 代码与配置。

## 结论

- Linux EC2 三维指标已覆盖 47/47；未重启或停机 EC2。
- `mega-rds-lark` 已上线慢查询阈值、SQL 指纹聚合、去重窗口和 TopN 汇总，参数可通过环境变量配置。
- `mongo-slowquery` 已升级至版本 `:2`，按 repl、kline、data 日志组路由通知，并完成对应采集与订阅配置。
- 已修复 `COLLSCAN` 分支绕过时长阈值的问题，并改善索引建议与查询样例展示。
- 后续优化项尚未执行，不应视为已完成。

## 证据与来源

- 来源：[`2026-04-07 AWS Mega 凭证脱敏源文档`](../../sources/reviews/2026/2026-04-07-aws-mega-slow-query-remediation-review.md)。
- 证据包括实例监控覆盖结果、Lambda 与日志组对应关系、版本发布记录、订阅配置、参数基线及低风险操作边界。
- 完整源档案保留原始结构，仅将凭据替换为具名变量；本页不复述密码、令牌、私钥或授权值。

## 风险与后续行动

- RDS Lambda 超时仍可评估由 3 秒调整为 10 秒，以降低批量日志抖动风险。
- 通知可补充 `logStream` 和时间戳，便于回溯 CloudWatch 原始事件。
- 并发增大时，可评估将内存去重迁移至 DynamoDB TTL，以获得跨实例稳定性。
- 上述事项均为可选后续优化，源文档未声明其已执行。
