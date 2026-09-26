---
title: Review - Hashdev EKS deployment retrospective
created: 2026-09-26
updated: 2026-09-26
status: draft
owners: [liuzel01]
sources: ["sources/reviews/2026/2026-04-01-hashdev-eks-deployment-review.md"]
generated:
  tool: openclaw
  skill: review
  skill_version: null
  reviewed_by: null
---

# Review - Hashdev EKS deployment retrospective

## 背景与范围

本页总结 hashdev EKS 新环境部署复用要点，覆盖部署前准备、资源创建顺序、RBAC 与配置加载、数据库与 MongoDB 依赖、xxl-job 启动窗口、网络调度、验收清单及部署文件基线。

## 结论

- 建议按“RBAC → ConfigMap/Secret → 中间件 → 业务服务 → 健康检查”顺序部署。
- 本次暴露的主要风险包括 ConfigMap 读取权限缺失、代码与数据库 schema 不匹配、MongoDB 连接数耗尽、xxl-job-admin 未就绪，以及子网 IP 耗尽。
- 线上临时修复必须同步回本地 YAML，避免后续 `kubectl apply` 覆盖。
- 源文档提供了验收标准和改进建议，但未证明所有验收项均已完成。

## 证据与来源

- 来源：[`2026-04-01 Hashdev EKS 凭证脱敏源文档`](../../sources/reviews/2026/2026-04-01-hashdev-eks-deployment-review.md)。
- 关键证据包括 ConfigMap `Forbidden`、数据库字段不匹配、MongoDB `too many open connections`、xxl-job 注册时序问题及 AWS CNI IP 分配失败事件。
- 完整源档案保留原始结构，仅将凭据替换为具名变量；本页不复述密码、令牌、私钥或授权值。

## 风险与后续行动

- 部署前核对集群上下文、命名空间、镜像拉取凭据、依赖地址及 ConfigMap 实际加载关系。
- 先补齐 Role/RoleBinding，再验证配置是否生效。
- 按实际数据源库核对并备份数据库 schema，优先执行最小结构变更。
- 控制应用连接池，配置 MongoDB 文件句柄与连接上限，并为 xxl-job-admin 增加启动及就绪探针。
- 检查节点子网剩余 IP；必要时在同 AZ 新增子网并迁移 nodegroup。
- 以 rollout、日志、events 及关键接口 smoke test 作为验收依据；出现 RBAC Forbidden、schema mismatch 或连接耗尽时停止批量重启。
