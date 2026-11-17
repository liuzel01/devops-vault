---
title: Review - CLIProxyAPI OpenClaw main integration
created: 2026-09-26
updated: 2026-11-17
type: review
status: published
publish: true
tags: [openclaw, cliproxyapi, oauth, llm, troubleshooting]
owners: [liuzel01]
sources: ["sources/reviews/2026/2026-04-13-cliproxyapi-openclaw-main-integration-review.md"]
generated:
  tool: openclaw
  model: null
  reviewed_by: liuzel01
---

# Review - CLIProxyAPI OpenClaw main integration

## 背景与范围

本次评审覆盖在 `l01-openclaw` 部署 CLIProxyAPI，并将 OpenClaw `profile: main` 接入 cliproxy 链路，以解决 OAuth 刷新失败并支持多模型切换；其他实例未改默认模型。

## 结论

- `main` 的 OAuth 刷新失败根因是默认模型仍为 `openai-codex/gpt-5.4`，并非 cliproxy 故障。
- 源记录显示切换至 `cliproxy/gpt-5.4` 后业务对话恢复。
- CLIProxyAPI 服务、管理 API 和管理面板均记录为可用；`main` 白名单包含 12 个 `cliproxy/*` 模型。

## 证据与来源

- 来源：`2026-04-13 CLIProxyAPI 凭证脱敏源文档`（仓库路径：`sources/reviews/2026/2026-04-13-cliproxyapi-openclaw-main-integration-review.md`）。
- 关键证据包括端口监听、模型列表、授权文件状态及默认模型切换后的对话验证。
- 完整源档案保留原始结构；凭证值已替换为具名变量。

## 风险与后续行动

- 轮换接口与管理凭据，并增加端口访问审计、5xx、429 和鉴权失败告警。
- 固化 OAuth 接入、模型白名单同步和基于备份配置的回滚 SOP；Copilot 接入单独 PoC。
