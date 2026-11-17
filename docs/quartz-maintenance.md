# Quartz 维护说明

## 当前版本

- Quartz：5.1.0；
- 上游：`jackyzha0/quartz`；
- 上游提交：`7cfb0796165c848be5438117e9806802123bf676`；
- 许可文件：`quartz/LICENSE.txt`。

Quartz 引擎保存在仓库的 `quartz/`，站点配置位于 `quartz.config.yaml`。依赖由根目录 `package.json` 和 `package-lock.json` 固定。

## 内容输入边界

`content/` 是唯一构建入口：

```text
content/
├── index.md
├── reviews -> ../reviews
├── weekly  -> ../weekly
└── wiki    -> ../wiki
```

符号链接避免复制 Markdown。`sources/`、`daily/`、`inbox/`、`templates/`、`scripts/` 和 `docs/` 不在 Quartz 输入目录中。

`@quartz-community/explicit-publish` 进一步要求页面必须设置 `publish: true`。`configuration.publishAssets: referenced` 只复制已发布页面引用的资源。

## 构建与验证

```bash
npm ci
npm run build:site
```

构建依次执行：

1. Markdown 和 frontmatter 校验；
2. Quartz 构建；
3. `scripts/check-site-output.mjs` 检查禁止目录、未发布页面和必要页面。

生成目录 `public/` 已加入 `.gitignore`，不得提交。

## 本地预览

```bash
npm run preview:site
```

默认站点地址配置为 `liuzel01.github.io/devops-vault`，用于 GitHub Pages 项目子路径下的 sitemap、RSS 和分享元数据。

## 升级 Quartz

升级前先创建独立分支，并从上游目标 tag 获取以下内容：

- `quartz/`；
- `quartz.ts`、`globals.d.ts`、`index.d.ts`、`tsconfig.json`；
- `package.json` 中 Quartz 的 dependencies 和 devDependencies。

合并项目脚本与元数据后更新 lockfile，执行 `npm ci`、`npm run check` 和 `npm run build:site`。不要直接覆盖本仓库的 README、内容目录或 Git remote。升级完成后更新本文记录的版本和提交。
