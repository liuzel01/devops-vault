# Weekly 与 Review 的人工生成

Weekly、Review 和复盘不由 `launchd` 自动生成。必须由操作者在 OpenClaw 会话中确认资料范围、结论和脱敏要求，再将正文交给仓库脚本。

## Weekly

先进行 dry-run：

```bash
node scripts/generate-weekly.mjs --week 2026-W39 --date 2026-09-25 --body-file /absolute/path/to/weekly-body.md
```

确认路径和分支后添加 `--execute`。脚本只允许从干净的本地 `main` 运行，并创建 `agent/2026-W39-weekly` 分支。需要推送和 Draft PR 时，依次追加 `--push --create-pr`，并确保 `gh auth login` 已完成。

## Review / 复盘

Review 必须提供稳定、无敏感信息的英文 slug：

```bash
node scripts/generate-review.mjs \
  --title 'Incident postmortem' \
  --slug incident-postmortem \
  --date 2026-09-25 \
  --body-file /absolute/path/to/review-body.md
```

确认 dry-run 后添加 `--execute`。生成路径为 `reviews/<year>/<date>-<slug>.md`，分支为 `agent/<date>-<slug>`。脚本不会自动批准、合并或绕过 GitHub 分支保护。
