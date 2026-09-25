# 本地 Daily 自动化

Daily 生成由本机 OpenClaw 会话或 `launchd` 调用同一个脚本完成。脚本默认是 dry-run；只有显式传入 `--execute` 才会创建 Git 分支、写入文档并提交。

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

## 定时触发

`launchd` 仅适用于已稳定的“生成 Daily 草稿”任务。定时任务必须调用同一脚本，并将 `--execute`、`--push`、`--create-pr` 是否允许写得明确；初期建议只生成草稿、创建 Draft PR，绝不自动合并。

不要让定时任务自动生成 Weekly、Review、事故复盘或 Wiki 结论。这些任务必须通过人工 OpenClaw 会话补充上下文并确认资料范围。

## 失败处理

- dry-run 或校验失败：不改变 Git 状态；修复输入后重试。
- `--execute` 后的校验失败：生成分支和未提交草稿会保留，便于人工检查；不得从该状态直接推送。
- PR 创建失败：本地 commit 和已推送分支仍可保留；完成 GitHub CLI 登录后单独执行 `gh pr create`。
