# Weekly 与 Review 的人工生成

Weekly、Review 和复盘可以由 Codex、其他 Code Agent 或人工整理，但必须由操作者确认资料范围、结论、发布状态和脱敏要求。生成脚本默认只执行 dry-run，不会直接修改仓库。

## Weekly

先进行 dry-run：

```bash
node scripts/generate-weekly.mjs --week 2026-W39 --date 2026-09-25 --body-file /absolute/path/to/weekly-body.md
```

确认路径、正文和分支后添加 `--execute`。脚本只允许从干净的本地 `main` 运行，并创建 `agent/2026-W39-weekly` 分支。需要推送和 Draft PR 时，依次追加 `--push --create-pr`，并确保 `gh auth login` 已完成。

## Review / 复盘

Review 必须提供稳定、无敏感信息的英文 slug：

```bash
node scripts/generate-review.mjs \
  --title 'Incident postmortem' \
  --slug incident-postmortem \
  --date 2026-09-25 \
  --body-file /absolute/path/to/review-body.md
```

确认 dry-run 后添加 `--execute`。生成路径为 `reviews/<year>/<date>-<slug>.md`，分支为 `agent/<date>-<slug>`。脚本不会批准、合并 PR 或绕过仓库规则。

## 人工确认

生成后的文档保持 `status: draft` 和 `publish: false`。在改为可发布状态前，必须检查结论与来源、公开脱敏、来源引用、生成工具记录，并运行 `npm run validate`。
