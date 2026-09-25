# 本地 Daily 自动化

Daily 生成只能由本机 OpenClaw 会话人工发起。脚本默认是 dry-run；只有显式传入 `--execute` 才会创建 Git 分支、写入文档并提交。

## 人工触发

在 OpenClaw 会话中先核对资料和结论，再将生成正文保存到临时 Markdown 文件，随后运行：

```bash
node scripts/generate-daily.mjs --date 2026-09-25 --body-file /absolute/path/to/daily-body.md
```

确认 dry-run 的分支和目标路径正确后，才执行：

```bash
node scripts/generate-daily.mjs --date 2026-09-25 --body-file /absolute/path/to/daily-body.md --execute
```

这会从干净的本地 `main` 创建 `agent/2026-09-25-daily`，写入 `daily/2026/09/2026-09-25.md`、运行校验并创建本地 commit。要推送分支，额外传入 `--push`；要创建 Draft PR，额外传入 `--push --create-pr`。后两项要求已完成 `gh auth login`。

## 不支持定时触发

Daily 是否需要生成取决于当天是否有值得沉淀的工作；因此本仓库不提供 Daily 的 `launchd` 任务。每次生成必须由人工在 OpenClaw 会话中确认来源、标签、结论和脱敏范围后发起。

定时能力只适用于 Weekly 的 Draft PR，详见 `docs/launchd-weekly-adapter.md`。Review、事故复盘和 Wiki 结论也必须通过人工 OpenClaw 会话触发。

## 失败处理

- dry-run 或校验失败：不改变 Git 状态；修复输入后重试。
- `--execute` 后的校验失败：生成分支和未提交草稿会保留，便于人工检查；不得从该状态直接推送。
- PR 创建失败：本地 commit 和已推送分支仍可保留；完成 GitHub CLI 登录后单独执行 `gh pr create`。
