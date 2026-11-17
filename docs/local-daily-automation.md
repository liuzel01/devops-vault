# 本地 Daily 生成

Daily 可以由 Code Agent 或人工整理，但只允许人工触发。脚本默认是 dry-run；只有显式传入 `--execute` 才会创建 Git 分支、写入文档并提交。

## 人工触发

```bash
node scripts/generate-daily.mjs --date 2026-09-25 --body-file /absolute/path/to/daily-body.md
```

确认 dry-run 输出后执行：

```bash
node scripts/generate-daily.mjs --date 2026-09-25 --body-file /absolute/path/to/daily-body.md --execute
```

脚本从干净的本地 `main` 创建 `agent/2026-09-25-daily`，写入 `daily/2026/09/2026-09-25.md`、运行校验并创建本地 commit。追加 `--push` 可推送分支；追加 `--push --create-pr` 可创建 Draft PR。

## 不支持定时触发

Daily 是否值得沉淀需要人工判断，因此不提供定时任务。Daily 默认使用 `publish: false`，当前网站规划也不会发布 `daily/`。

## 失败处理

- dry-run 或校验失败：不改变 Git 状态，修复输入后重试；
- `--execute` 后校验失败：保留生成分支和未提交草稿供人工检查，不得直接推送；
- PR 创建失败：保留本地 commit 和已推送分支，稍后单独执行 `gh pr create`。
