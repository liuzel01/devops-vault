# launchd Weekly 适配器

本仓库提供 Weekly 的可选定时 Draft PR 入口：`automation/launchd/com.liuzel01.devops-vault.weekly.plist.example` 和 `scripts/run-scheduled-weekly.zsh`。它每周一 09:10 生成上一完整 ISO 周的周报草稿；绝不自动合并。

Daily、Review、事故复盘与 Wiki 没有也不得安装定时任务，必须由人工在 OpenClaw 会话中确认上下文后触发。

## 适配器契约

定时脚本通过 `DEVOPS_VAULT_WEEKLY_GENERATOR` 获取适配器绝对路径，并传入两个参数：输出 Markdown 正文的临时路径和目标 ISO 周。

```text
openclaw-weekly-adapter /private/var/folders/.../devops-vault-weekly.XXXXXX 2026-W38
```

适配器必须调用已批准的 OpenClaw Weekly skill，仅将脱敏后的 Markdown 正文写入输出路径，并以非零退出码报告失败。它不得修改仓库、创建分支、提交、推送或输出凭据；这些均由仓库脚本在检查干净 `main`、同步远端后完成。

## 安装前检查

1. 替换 plist 中的 `DEVOPS_VAULT_WEEKLY_GENERATOR` 占位路径，并确认 Node 路径有效。
2. 完成 `gh auth login`；未登录时任务会停止，不会创建不可审核的远端变更。
3. 先运行 dry-run：

```bash
DEVOPS_VAULT_DIR=/Users/liuzelin/github/devops-vault \
DEVOPS_VAULT_NODE=/Users/liuzelin/.nvm/versions/node/v22.22.3/bin/node \
/bin/zsh scripts/run-scheduled-weekly.zsh --dry-run
```

4. 单独验证适配器输出非空、已脱敏且不修改仓库。
5. 审核首次 Draft PR 后，才手动执行 `launchctl bootstrap`。本计划不自动安装或启动该任务。
