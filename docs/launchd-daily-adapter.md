# launchd Daily 适配器

本仓库提供 `automation/launchd/com.liuzel01.devops-vault.daily.plist.example` 和 `scripts/run-scheduled-daily.zsh`，但**没有**擅自假定本机 OpenClaw 的命令行接口。启用前必须实现一个本地、可执行的 OpenClaw 适配器。

## 适配器契约

定时脚本通过 `DEVOPS_VAULT_DAILY_GENERATOR` 获得适配器的绝对路径，并以一个参数调用：

```text
openclaw-daily-adapter /private/var/folders/.../devops-vault-daily.XXXXXX.md
```

适配器必须：

1. 调用已批准的 OpenClaw Daily skill 或会话；
2. 只将**脱敏后的 Markdown 正文**写入该输出路径；
3. 非零退出码表示生成失败；
4. 不得修改此仓库、不创建 Git 分支、不提交、不推送，也不得输出 Token；
5. 生成空文件时，调度脚本会拒绝继续创建 PR。

仓库脚本负责其余流程：验证干净 `main`、同步远端、创建 `agent/<date>-daily`、运行校验、提交、推送并创建 Draft PR。

## 安装前检查

1. 复制 plist 示例到 `~/Library/LaunchAgents/` 前，替换 `DEVOPS_VAULT_DAILY_GENERATOR` 的占位路径，并确认 Node 路径仍有效。
2. 完成 `gh auth login`；调度脚本会在未登录时停止，避免生成无法审核的孤立远端变更。
3. 先以 dry-run 测试仓库侧逻辑：

```bash
DEVOPS_VAULT_DIR=/Users/liuzelin/github/devops-vault \
DEVOPS_VAULT_NODE=/Users/liuzelin/.nvm/versions/node/v22.22.3/bin/node \
/bin/zsh scripts/run-scheduled-daily.zsh --dry-run
```

4. 单独测试适配器输出是否非空、是否已脱敏、是否不修改仓库。
5. 审核生成的 Draft PR 后，才执行 `launchctl bootstrap`。本计划不自动安装或启动该任务。

## 行为边界

- 每个工作日 18:10 仅生成一个 Daily Draft PR；不会自动合并。
- 若已有当天的 Daily、工作区不干净、分支不是 `main`、同步失败、OpenClaw 生成失败或 GitHub CLI 未登录，任务会安全失败。
- Weekly、Review、事故复盘和 Wiki 永远不绑定该定时任务。
