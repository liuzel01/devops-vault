# OpenClaw Skill 集成边界

> **已归档：** 本集成已于 2026-11-17 停用，仅供历史追溯。当前仓库不依赖 OpenClaw skill。

当前本机的 `obsidian-daily-archive` skill 可正常使用，但它服务旧的个人 Obsidian Vault：它直接创建/更新 `Daily/`、`Wiki/`、`Weekly/`，并在 Daily 归档后默认刷新周报。不要把它直接配置为 `devops-vault` 的定时适配器，也不要在没有迁移设计的情况下改写其旧 Vault 路径。

推荐新增独立的 `devops-vault-publish` skill，而非修改现有 skill。它应：

1. 在人工 Daily/Review/Wiki 请求中收集来源、标签、脱敏确认和目标文档类型；
2. 调用仓库的 `generate-daily.mjs`、`generate-review.mjs` 或 `generate-weekly.mjs`，先执行 dry-run；
3. 仅在用户明确确认后传入 `--execute`，并在需要时由已登录的 GitHub CLI 创建 Draft PR；
4. 对定时 Weekly，仅实现“将上一完整周的已合并 Daily 与 Review 汇总为 Markdown 正文”的适配器契约；
5. 绝不直写 `main`、自动合并、向 Git/PR/日志写入密钥或未经脱敏的来源。

在该 skill 创建前，仍可人工在现有 OpenClaw 会话中生成正文，并按 `docs/local-daily-automation.md`、`docs/manual-weekly-and-review-generation.md` 调用脚本。
