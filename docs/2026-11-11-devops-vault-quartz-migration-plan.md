# DevOps Vault：Review 知识库与 Quartz 发布实施计划

> 计划日期：2026-11-11  
> 状态：实施中（阶段一至阶段四已完成）
> 目标仓库：`liuzel01/devops-vault`

## 1. 目标与最终决策

本计划将现有 `devops-vault` 收敛为个人 Review 知识库和公开只读文档站。后续不再维护独立 Hugo 内容仓库，不再使用 OpenClaw 作为生成链路，也不创建新的内容仓库。

```text
Codex / 其他 Code Agent / 人工整理
              ↓
      devops-vault（唯一事实来源）
              ├── reviews/  网站主体
              ├── weekly/   可选辅助内容
              ├── wiki/     后续稳定知识
              ├── sources/  已脱敏证据链，不进入网站
              └── inbox/    待加工资料，不发布
              ↓
      GitHub Actions 校验、构建
              ↓
          GitHub Pages
```

核心原则：

1. `devops-vault` 是唯一需要持续维护的内容仓库。
2. Markdown + Git 是唯一事实来源，Obsidian 只是本地编辑和检索工具。
3. `reviews/` 是当前网站的主要内容，`weekly/` 作为补充。
4. AI 或 Code Agent 只能生成草稿，不能绕过校验和人工确认直接修改 `main`。
5. 网站只发布明确允许公开的内容；来源、草稿和内部流程文档默认不发布。
6. GitHub Pages 承担静态发布，不需要独立服务器或云主机。

## 2. 当前仓库审查结论

### 2.1 符合目标的部分

| 路径 | 当前情况 | 结论 |
| --- | --- | --- |
| `reviews/` | 2026 年有 10 篇 Review | 保留，作为网站主体 |
| `sources/` | 有 10 篇脱敏源文档 | 保留在公开仓库，但禁止进入网站 |
| `weekly/` | 有 1 篇 Weekly | 保留，作为可选内容 |
| `daily/` | 只有 `.gitkeep` | 保留占位，不强制填充 |
| `wiki/` | 只有 `.gitkeep` | 保留占位，后续从 Review 提炼 |
| `inbox/` | 只有 `.gitkeep` | 保留占位，作为待加工区 |
| `templates/` | Daily、Weekly、Review、Wiki 模板 | 保留并更新元数据规范 |
| `scripts/` | 有生成和校验脚本 | 保留可复用部分，移除旧工具耦合 |
| `.github/workflows/` | 只有校验 workflow | 保留校验并新增 Pages 发布 workflow |
| `.obsidian/` | 仅占位文件 | 保留，避免提交本地状态 |

### 2.2 不符合最终方案的部分

以下内容仍然描述旧的团队/OpenClaw 方案，需要重构：

- `README.md` 仍将 OpenClaw 作为生成工具；
- `docs/openclaw-*.md` 和 `docs/*openclaw*` 仍是主要操作入口；
- `docs/launchd-weekly-adapter.md`、`automation/launchd/` 和 `scripts/run-scheduled-weekly.zsh` 引入了不再需要的本机定时维护；
- `scripts/generate-*.mjs` 的说明和 frontmatter 默认值仍指向 OpenClaw；
- 现有 Review 的 `status` 均为 `draft`，`generated.tool` 均为 `openclaw`，不能直接作为已发布网站内容；
- 当前 GitHub Actions 只执行 Node 校验和 gitleaks，没有构建或部署网站；
- 当前 `sources/` 与 `reviews/` 的发布边界没有由 Quartz 构建配置自动保证。

### 2.3 总体判断

不需要重建仓库，也不需要迁移到新仓库。推荐在现有仓库上做收敛式重构：保留内容目录和 Git 历史，保留数据分类、敏感信息扫描和 Markdown 校验，归档旧流程，集成 Quartz，并用 GitHub Actions 完成 Pages 部署。

## 3. 目标目录结构

```text
devops-vault/
├── README.md
├── package.json
├── reviews/                         # 主要公开内容
│   └── YYYY/YYYY-MM-DD-<slug>.md
├── weekly/                          # 可选公开内容
├── wiki/                            # 后续沉淀的稳定知识
├── daily/                           # 占位或个人过程记录
├── inbox/                           # 待加工资料，不发布
├── sources/                         # 已脱敏证据链，不进入网站
├── templates/                       # 文档模板
├── scripts/                         # 生成、校验和本地辅助脚本
├── docs/                            # 项目设计和维护文档
├── quartz/                          # Quartz 配置、组件和主题定制
└── .github/workflows/
    ├── validate.yml                # PR/Push 校验
    └── pages.yml                   # 构建并发布 GitHub Pages
```

Quartz 必须通过输入目录或忽略规则确保以下路径不会进入发布产物：`sources/`、`inbox/`、`templates/`、`scripts/`、`docs/`，以及暂不公开的 `daily/`。不得复制一份 `reviews/`，避免出现两份事实来源。

## 4. 内容和元数据规范

Review 建议统一使用：

```yaml
---
title: Review - 示例标题
created: 2026-11-11
updated: 2026-11-11
type: review
status: published
publish: true
tags: [devops, troubleshooting]
sources:
  - sources/reviews/YYYY/example.md
generated:
  tool: codex
  model: null
  reviewed_by: liuzel01
---
```

状态含义：`draft` 为草稿，`review` 为等待人工确认，`published` 为允许发布，`archived` 为保留但不再维护。没有 `publish: true` 的页面默认不发布。

现有 10 篇 Review 不应直接批量标记为 published，应逐篇检查标题、来源、结论、日志、域名、IP、截图和敏感信息；确认后再更新状态。过时的 `generated.tool: openclaw` 必须改为实际工具或删除。

Hugo 仓库只筛选迁移真正有长期价值且可公开的文章，分别归入 `reviews/` 或 `wiki/`。迁移完成后 Hugo 作为历史归档，不再接收新内容或维护第二套部署。

## 5. 自动化和 GitHub Actions

### 5.1 保留并增强校验

保留现有 `validate.yml` 的 Node 校验和 gitleaks 扫描，并增加：

- frontmatter 和 `publish` 字段检查；
- 发布目录边界检查；
- WikiLink、相对链接和资源引用检查；
- Quartz 构建检查；
- 禁止提交构建产物。

### 5.2 新增 Pages workflow

新增 `.github/workflows/pages.yml`，在 `main` push 和 `workflow_dispatch` 时执行：

1. checkout；
2. 安装 Node.js 22 和依赖；
3. 执行内容校验和敏感信息扫描；
4. 构建 Quartz；
5. 上传 Pages artifact；
6. 部署到 GitHub Pages。

workflow 使用 `contents: read`、`pages: write`、`id-token: write`，不需要云主机密钥或额外部署 Secret。

### 5.3 删除或归档旧流程

以下内容不再属于主流程：

- `automation/launchd/`；
- `scripts/run-scheduled-weekly.zsh`；
- `docs/launchd-weekly-adapter.md`；
- `docs/openclaw-review-publish-runbook.md`；
- `docs/openclaw-skill-integration.md`；
- 依赖 `openclaw` 命令、skill 或本机 LaunchAgent 的自动化。

删除前确认没有未合并分支或本地使用依赖；需要保留历史时移动到 `docs/archive/`，并明确标注“不再适用”。

## 6. 分阶段实施计划

### 阶段一：仓库收敛

- 更新 README 和目录契约；
- 修订 Review、Weekly、Wiki 模板；
- 将 Codex/Code Agent 设为默认生成工具；
- 清理或归档 OpenClaw/launchd 文档和脚本；
- 保留并验证现有内容和 Git 历史。

验收：新用户仅使用 Codex、Git 和 Obsidian 即可工作，文档不再把 OpenClaw 作为必需组件。

### 阶段二：内容整理

- 逐篇审核现有 Review；
- 设置 `status`、`publish`、`tags` 和来源字段；
- 完成公开脱敏；
- 确认 `sources/` 不会被网站构建；
- 选择 Hugo 中需要迁移的少量文章；
- 保持 daily、weekly、wiki 的占位结构。

验收：公开页面均有人工确认，草稿和来源文档不会默认发布。

### 阶段三：Quartz 集成

- 在当前仓库集成 Quartz；
- 配置站点标题、作者、基础路径和导航；
- 配置输入目录和忽略规则；
- 本地验证 Review、Weekly、标签、搜索、反向链接和资源；
- 验证项目站点子路径下的链接。

验收：本地构建成功，网站只出现允许公开的 Markdown。

### 阶段四：GitHub Pages 部署

- 新增 Pages workflow；
- 在仓库设置中选择 GitHub Actions 作为 Pages 发布源；
- 使用最小权限配置 workflow；
- 检查页面、搜索、资源、404 和移动端布局。

验收：合并到 `main` 后自动完成校验、构建和部署，不需要服务器或本地发布命令。

### 阶段五：持续维护

- 新 Review 统一进入 `reviews/`；
- Code Agent 只创建草稿分支或 Draft PR；
- 人工检查结论、证据、脱敏和 `publish` 状态；
- 合并后由 Actions 自动发布；
- 只有稳定、可复用的结论才提炼到 `wiki/`；
- 不为 Daily、Weekly、Wiki 强行制造内容。

## 7. 前置条件

必须具备：GitHub 仓库管理权限、GitHub Actions 和 Pages 可用、本地 Node.js 22、Git、可选的 GitHub CLI、Obsidian，以及一份 Review 公开清单。

不需要具备：独立云主机、Nginx、Docker、域名、云厂商 Access Key、第二个内容仓库或专用部署 Secret。

默认地址：

```text
https://liuzel01.github.io/devops-vault/
```

未来增加域名只需配置 DNS 和 `CNAME`，不改变内容仓库和发布链路。

## 8. 风险与控制

| 风险 | 控制措施 |
| --- | --- |
| 私有来源被公开 | Quartz 忽略规则、构建产物检查、人工抽查 |
| 草稿意外上线 | `publish: true` 白名单机制 |
| AI 结论不准确 | Draft PR、人工核验、保留来源和证据 |
| 旧流程误触发 | 删除/归档旧脚本和文档，更新 README |
| Pages 路径错误 | 配置 `baseUrl`，在项目子路径本地验证 |
| 凭证进入 Git 历史 | gitleaks + 人工脱敏，泄露后立即撤销 |
| 内容双份漂移 | Quartz 直接读取唯一源目录，不复制 Review |

## 9. 第一批任务清单

- [x] 确认 GitHub Pages 可用并确认站点地址；
- [x] 更新 README、模板和 frontmatter 约定；
- [x] 为现有 10 篇 Review 建立公开审核清单；
- [x] 清理或归档 OpenClaw/launchd 文档和脚本；
- [x] 集成 Quartz，禁止非发布目录进入网站；
- [x] 增加构建校验和 Pages workflow；
- [x] 本地构建并检查页面；
- [x] 首次部署到 GitHub Pages；
- [x] 从 Hugo 筛选并迁移少量文章；
- [ ] 将后续 Review 流程切换为 Codex/Code Agent + Draft PR。

## 10. 完成定义

1. 新 Review 只需进入 `devops-vault`，不需要维护第二套博客仓库；
2. `reviews/` 可在 Obsidian 中编辑，也可自动发布到 GitHub Pages；
3. 草稿、来源和敏感资料不会被默认发布；
4. GitHub Actions 自动完成校验、构建和部署；
5. 日常发布不依赖 OpenClaw、launchd 或独立服务器；
6. Hugo 仅作为历史来源，不再是持续维护的发布系统。
