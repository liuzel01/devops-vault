# DevOps Vault

本仓库是个人 DevOps Review 知识库，也是公开只读知识库网站的唯一内容来源。Markdown 与 Git 是事实来源；Obsidian、Codex、其他 Code Agent 或人工编辑都只是内容生产方式。

Quartz 迁移目标和分阶段任务见 [Quartz 发布实施计划](docs/2026-11-11-devops-vault-quartz-migration-plan.md)，数据边界见 [数据分类与贡献规范](docs/contributing-and-data-classification.md)。

## 目录与发布边界

| 路径 | 用途 | 网站发布 |
| --- | --- | --- |
| `reviews/` | Review、复盘和专题结论 | 仅发布 `publish: true` 的内容 |
| `weekly/` | 可选的周期总结 | 仅发布 `publish: true` 的内容 |
| `wiki/` | 稳定、可复用的知识 | 仅发布 `publish: true` 的内容 |
| `daily/` | 个人过程记录或占位 | 默认不发布 |
| `sources/` | 已脱敏的来源与证据链 | 不发布 |
| `inbox/` | 待加工资料 | 不发布 |
| `templates/` | 文档模板 | 不发布 |
| `docs/` | 项目设计与维护文档 | 不发布 |
| `scripts/` | 本地生成与校验工具 | 不发布 |

公开仓库中的内容仍必须完成脱敏。网站发布边界将在 Quartz 配置和 CI 中强制执行，不能仅依赖目录约定。

## 内容状态

- `draft`：草稿；
- `review`：等待人工确认；
- `published`：允许发布；
- `archived`：保留但不再维护。

只有同时满足 `status: published` 和 `publish: true` 的页面才允许进入网站。现有内容不会自动转为公开页面。

## 基本工作流

1. 使用模板、仓库生成脚本、Code Agent 或人工方式创建草稿。
2. 在独立 `agent/<date>-<topic>` 分支中修改。
3. 检查结论、来源、公开范围和脱敏结果。
4. 运行 `npm run validate`。
5. 创建 Draft PR；CI 通过并经人工确认后才能合并。
6. 需要发布时，人工设置 `status: published` 和 `publish: true`。

生成工具不能绕过校验、人工确认或直接修改 `main`。不得提交密码、Token、私钥、云访问密钥、Authorization 值、完整敏感请求载荷或客户数据。

## 本地要求

- Node.js 22 或更高版本；
- Git；
- 可选：GitHub CLI、Obsidian、Codex 或其他 Code Agent。

```bash
npm run validate
```

旧 OpenClaw/launchd 流程仅作为历史资料保存在 [`docs/archive/`](docs/archive/README.md)，不再是当前工作流的一部分。
