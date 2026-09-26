---
title: CLIProxyAPI OpenClaw main integration review
created: 2026-04-13
updated: 2026-09-26
status: archived
owners: [liuzel01]
sources: ["local OpenClaw workspace review, migrated to this repository"]
source_kind: credential-redacted-operational-source
redaction: "Applied only to passwords, tokens, private keys, authorization headers, and cloud access-key material."
reviewed_by: liuzel01
---
# 2026-04-13｜CLIProxyAPI 接入 OpenClaw（l01-openclaw / profile main）复盘

## 一、目标

在 `l01-openclaw`（`13.231.157.228`）上部署 CLIProxyAPI，并将 OpenClaw `profile: main` 切换到 cliproxy 链路，解决 `openai-codex` OAuth 刷新失败问题，同时支持多模型切换。

约束：

- 尽量不影响其他 OpenClaw 实例
- 每次关键改动先备份，必要时可回滚

---

## 二、环境与现状确认

- 主机资源健康：CPU 空闲、内存和磁盘余量充足
- OpenClaw 多实例并存（main/second/testing/kelly/ops 等）
- 端口冲突检查后确认可用默认端口 `8317`

---

## 三、实施过程

### 1) 部署 CLIProxyAPI

- 部署目录：`/opt/cliproxyapi`
- 运行方式：Docker 容器 `cliproxyapi`
- 初始配置落地：
  - `/opt/cliproxyapi/runtime/config.yaml`
  - `/opt/cliproxyapi/runtime/auths/`
  - `/opt/cliproxyapi/runtime/logs/`
  - `/opt/cliproxyapi/runtime/SECRETS.txt`
- 生成并保存：
  - `API_KEY`（业务接口鉴权）
  - `MANAGEMENT_KEY`（管理 API 鉴权）

### 2) 端口策略调整

- 按要求改为默认端口映射：`8317:8317`
- 验证监听成功：`0.0.0.0:8317`

### 3) main 接入 cliproxy provider（首次）

- 在 `/root/.openclaw/openclaw.json` 增加：`models.providers.cliproxy`
- 一次小失误：`apiKey` 被误写占位符 `%s`
- 立即修复并重启 main 服务

### 4) 管理面板问题定位

- 现象：
  - `/v0/management/config` 返回 `remote management disabled`
  - 浏览器访问某些管理路径 404
- 根因：
  - `allow-remote` 初始是 `false`
  - 页面入口路径不是 `/v0/management/...`，而是 `/management.html`
- 修复：
  - 将 `remote-management.allow-remote: true`
  - 重启容器

### 5) OAuth Codex 账号接入

- 用户在管理面板完成 3 个账号 OAuth
- 验证结果：
  - `/v1/models` 从空变为 12 个模型
  - `/v0/management/auth-files` 可见 3 个 active 授权文件
  - 授权文件已落盘到 `runtime/auths`

### 6) main 报错继续排查与修复

- 报错：`OAuth token refresh failed for openai-codex`
- 根因：`main` 默认模型仍是 `openai-codex/gpt-5.4`，未切到 cliproxy
- 修复：
  - `agents.defaults.model.primary` 改为 `cliproxy/gpt-5.4`
  - 重启 `openclaw-gateway.service`
- 验证：对话恢复正常，可收发回复

### 7) 扩展模型白名单

- 用户要求可切低配模型
- 从 cliproxy `/v1/models` 拉取可用模型并写入 `main` 白名单
- 最终 `cliproxy/*` 白名单共 12 个，可在 OpenClaw 中自由切换

---

## 四、关键结论

1. `main` 报 `openai-codex refresh 401` 的根因不是 cliproxy，而是默认模型没切过去。
2. 管理面板可用依赖两点：
   - `allow-remote=true`
   - 访问路径 `http://127.0.0.1:8317/management.html`（配合 SSH 隧道）
3. 若启用白名单模式，只配一个模型会导致 `/model` 切换报 not allowed。

---

## 五、当前最终状态

### CLIProxyAPI

- 服务：运行中（docker: `cliproxyapi`）
- 端口：`8317`
- 管理 API：可用
- 管理面板：可访问（`/management.html`）
- Codex OAuth 账号：3 个 active

### OpenClaw main

- 默认模型：`cliproxy/gpt-5.4`
- 白名单：12 个 `cliproxy/*` 模型
- 业务测试：正常回复

---

## 六、风险与后续建议

### 已控制

- 改动前均做配置备份
- 仅改指定实例（main），未改其他实例默认模型

### 建议后续

1. 做一次 key 轮换（API_KEY / MANAGEMENT_KEY）
2. 增加 8317 的访问审计与告警（5xx、429、鉴权失败）
3. 固化 SOP：
   - 新 OAuth 账号接入
   - 模型白名单同步
   - 回滚流程（恢复备份配置）
4. Copilot 接入建议单独 PoC，不和主链路混改

---

## 七、本次涉及关键路径

- CLIProxyAPI
  - `/opt/cliproxyapi/`
  - `/opt/cliproxyapi/runtime/config.yaml`
  - `/opt/cliproxyapi/runtime/SECRETS.txt`
  - `/opt/cliproxyapi/runtime/auths/`

- OpenClaw main
  - `/root/.openclaw/openclaw.json`
  - `openclaw-gateway.service`
