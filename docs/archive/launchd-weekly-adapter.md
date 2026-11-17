# launchd Weekly 适配器

> **已归档：** 本定时流程已于 2026-11-17 停用，相关脚本和 LaunchAgent 示例已删除，不应继续执行。

本仓库提供 Weekly 的可选定时 Draft PR 入口：`automation/launchd/com.liuzel01.devops-vault.weekly.plist.example`、`automation/launchd/install-weekly.zsh` 和 `scripts/run-scheduled-weekly.zsh`。它每周一 09:10 生成上一完整 ISO 周的周报草稿；绝不自动合并。

Daily、Review、事故复盘与 Wiki 没有也不得安装定时任务，必须由人工在 OpenClaw 会话中确认上下文后触发。

## 适配器契约

定时脚本通过 `DEVOPS_VAULT_WEEKLY_GENERATOR` 获取适配器绝对路径，并传入两个参数：输出 Markdown 正文的临时路径和目标 ISO 周。

```text
openclaw-weekly-adapter /private/var/folders/.../devops-vault-weekly.XXXXXX 2026-W38
```

适配器必须调用已批准的 OpenClaw Weekly skill，仅将脱敏后的 Markdown 正文写入输出路径，并以非零退出码报告失败。它不得修改仓库、创建分支、提交、推送或输出凭据；这些均由仓库脚本在检查干净 `main`、同步远端后完成。

已批准的实现位于已部署 skill 的 `scripts/openclaw-weekly-adapter.mjs`。它只把目标 ISO 周中已合并的 `daily/YYYY/MM/YYYY-MM-DD.md` 与 `reviews/YYYY/YYYY-MM-DD-*.md` 作为输入；没有任何来源时会退出，因而不会创建没有证据的 Weekly Draft PR。本机未合并的文档不会被调度器读取。

## 安装前检查

1. 确认 `devops-vault-publish` skill 已部署，且 plist 中的 `DEVOPS_VAULT_WEEKLY_GENERATOR` 与 `DEVOPS_VAULT_OPENCLAW_BIN` 都是可执行的绝对路径；`PATH` 必须能解析 `gh`，因为 LaunchAgent 不会加载交互式 shell 的 Homebrew 配置。
2. 完成 `gh auth login`；未登录时任务会停止，不会创建不可审核的远端变更。
3. 先运行 dry-run：

```bash
DEVOPS_VAULT_DIR=/Users/liuzelin/github/devops-vault \
DEVOPS_VAULT_NODE=/Users/liuzelin/.nvm/versions/node/v22.22.3/bin/node \
/bin/zsh scripts/run-scheduled-weekly.zsh --dry-run
```

4. 在有已合并 Daily 或 Review 的周，单独验证适配器输出非空、已脱敏且不修改仓库；没有任何来源的周应以非零退出码停止。
5. 预览安装：

```bash
/bin/zsh automation/launchd/install-weekly.zsh
```

6. 仅在首次 Draft PR 审核通过后，才显式安装并启动：

```bash
/bin/zsh automation/launchd/install-weekly.zsh --install
```

安装器会校验 plist 和两个可执行文件；不传 `--install` 不会写入 `~/Library/LaunchAgents` 或调用 `launchctl`。
