# OpenClaw 发布 Review Runbook

> **已归档：** 本流程已于 2026-11-17 停用，不应继续执行。当前流程见 [Weekly 与 Review 的人工生成](../manual-weekly-and-review-generation.md)。

本 Runbook 用于把一次可由团队维护的 Review 或事故复盘，从本地 OpenClaw 会话发布到本仓库的 `reviews/`，并创建 Draft PR。它是**人工触发**流程：不会由 `launchd` 自动生成、推送或合并 Review。

## 成功路径

```mermaid
flowchart LR
    A[本地 Review 资料] --> B[人工 OpenClaw 会话]
    B --> C[devops-vault-publish skill<br/>生成正文]
    C --> D[Dry-run<br/>确认路径与分支]
    D --> E[人工确认执行]
    E --> F[校验、提交、推送]
    F --> G[GitHub Draft PR]
    G --> H[CI 与人工审核]
    H --> I[合并到 main]
```

## 前置条件

在本机确认以下条件；不要通过 stash、reset 或强制切换绕过失败。

```bash
cd /Users/liuzelin/github/devops-vault
git switch main
git pull --ff-only origin main
git status --short
gh auth status
openclaw skills info devops-vault-publish
```

`git status --short` 必须没有输出。`devops-vault-publish` 应显示 `Ready`；GitHub CLI 必须已登录且可向本仓库创建分支和 Draft PR。

## 1. 在 OpenClaw 会话中准备正文并执行 Dry-run

新建或使用一个人工发起的 OpenClaw 会话，并明确调用 `devops-vault-publish`。把真实来源路径、预期结论和脱敏边界写清楚。例如：

```text
请使用 devops-vault-publish skill 发布一份团队 Review。

来源：/absolute/path/to/local-review.md
标题：CMS migration proxy cutover review
slug：cms-migration-proxy-cutover
日期：2026-09-26
结论：迁移完成；重点沉淀 CMS 子路径 rewrite、静态资源和 Host header 的验证与回滚方式。
脱敏边界：私有 Vault 可保留运行证据；密码、Token、私钥、云访问密钥和 Authorization 值必须替换为具名变量。

请先在仓库外生成正文，并只执行 dry-run。不要写文件、创建分支、推送或创建 PR；先报告目标路径、分支名和校验结果。
```

Skill 应生成一个仓库外的 Markdown 正文文件，并调用等价的 dry-run：

```bash
cd /Users/liuzelin/github/devops-vault
node scripts/generate-review.mjs \
  --title 'CMS migration proxy cutover review' \
  --slug cms-migration-proxy-cutover \
  --date 2026-09-26 \
  --source 'local reviewed source: /absolute/path/to/local-review.md' \
  --body-file /absolute/path/to/review-body.md
```

Dry-run 只输出计划的 `reviews/<year>/<date>-<slug>.md` 与 `agent/<date>-<slug>`，不改动 Git 或文件。

## 2. 人工核对并确认执行

在会话中确认以下内容后，才回复“确认执行”：

- 标题、日期、英文 slug 和目标路径正确；
- `--source` 能让团队成员找到可访问的来源，且不会误称本机文件已上传；
- 正文结论、证据、风险与回滚步骤准确；
- 没有密码、Token、私钥、云访问密钥、Authorization 值、敏感请求载荷或客户数据；
- 工作区仍从干净的 `main` 开始。

确认后，Skill 才可以执行：

```bash
node scripts/generate-review.mjs \
  --title 'CMS migration proxy cutover review' \
  --slug cms-migration-proxy-cutover \
  --date 2026-09-26 \
  --source 'local reviewed source: /absolute/path/to/local-review.md' \
  --body-file /absolute/path/to/review-body.md \
  --execute --push --create-pr
```

该命令会从 `main` 创建 `agent/2026-09-26-cms-migration-proxy-cutover`、写入 Review、运行校验、创建本地 commit、推送并创建 Draft PR。它不会批准、合并或直接向 `main` 推送。

## 3. 审核和合并

在 GitHub Draft PR 中确认：

1. `Validate vault content` 的 Markdown 和密钥扫描均成功；
2. Review 的 `sources`、结论、证据与回滚内容可供团队理解；
3. 变更不包含认证材料，也未误改无关文档。

完成审核后再由人工将 PR 标记为可审阅并合并。当前平台约束和补偿控制见[开发计划](2026-09-25-devops-vault-development-plan.md#当前-github-平台限制与补偿控制)。

## 完整源文档归档的边界

`generate-review.mjs` 当前只生成 `reviews/` 结论文档；它**不会**把 `--source` 所指本地文件复制到仓库。若需要把完整 Review 源文档作为团队证据链保存，必须在创建 PR 前把凭证脱敏后的文件明确加入 `sources/reviews/<year>/`，并满足 `source_kind`、`redaction`、`reviewed_by` 三项 frontmatter。

随后将 Review 的 `--source` 指向该仓库相对路径，例如：

```text
sources/reviews/2026/2026-09-21-mgbx-cms-egress-proxy-ec2-review.md
```

不要把“本机路径”写成已归档的仓库来源。完整源文档的规则见[数据分类与贡献规范](../contributing-and-data-classification.md#脱敏完整归档)。将“源文档归档 + Review 生成”收敛为同一个受限命令是后续自动化项；在实现并验证前，仍需由人工在同一 Draft PR 中复核该源文档。

## 常见失败处理

| 现象 | 处理 |
| --- | --- |
| `generation must start from local main` | 切回 `main`、同步远端；不要在旧 Agent 分支执行。 |
| `worktree must be clean` | 保留并处理现有改动，或换干净 checkout；不要自动 stash 或 reset。 |
| 已存在目标 Review 路径 | 人工编辑原文或选择新的日期/slug；不要覆盖已有复盘。 |
| 本地校验或 GitHub 密钥扫描失败 | 保留分支和失败证据，修复具体内容后重新校验；不要降低扫描规则。 |
| OpenClaw skill 不可用 | 运行 `openclaw skills info devops-vault-publish`；确认 workspace skill 部署状态后再重试。 |
