# DevOps Vault

本仓库是团队可共享 DevOps 知识的正式 Markdown 来源。OpenClaw 可协助生成草稿，Obsidian 可直接打开本仓库；所有 AI 生成内容必须经过校验和 Pull Request 审核后才能进入 `main`。

详细架构、三期计划和安全边界见 [开发计划](docs/2026-09-25-devops-vault-development-plan.md)。

## 目录

- `daily/`：每日记录；
- `weekly/`：周报；
- `reviews/`：Review、复盘和专题结论；
- `wiki/`：稳定主题知识页；
- `inbox/`：已脱敏、待加工资料；不视为正式知识；
- `templates/`：正式文档模板；
- `scripts/`：本地生成与校验入口。

## 基本工作流

1. 使用对应模板或 `scripts/generate-*` 生成草稿。
2. 在独立 `agent/<date>-<topic>` 分支中修改。
3. 运行 `node scripts/validate.mjs`。
4. 创建 Draft PR，写明来源、生成方式和人工核验项。
5. CI 通过并经人工审核后合并。

不得提交密钥、Token、私钥、完整生产配置、客户数据或未经脱敏的运维原文。详见 [数据分类与贡献规范](docs/contributing-and-data-classification.md)。
